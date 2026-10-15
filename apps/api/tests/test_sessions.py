"""A3: deleting a session removes its stored files, and only the owner can do it."""

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.db import get_conn
from app.core.storage import get_storage
from app.main import app
from tests.conftest import make_token
from tests.fakes import FakeConn, FakeStorage

A, B = str(uuid.uuid4()), str(uuid.uuid4())
SA, SB = str(uuid.uuid4()), str(uuid.uuid4())


@pytest.fixture
def env() -> Iterator[tuple[TestClient, FakeConn, FakeStorage]]:
    conn, storage = FakeConn(sessions={SA: A, SB: B}), FakeStorage()
    storage.objects = {
        f"{A}/{SA}/f1/notes.pdf": b"%PDF",
        f"{A}/{SA}/f2/unit3.docx": b"PK",
        f"{A}/other-session/f3/keep.pdf": b"%PDF",
        f"{B}/{SB}/f4/b.pdf": b"%PDF",
    }
    app.dependency_overrides[get_conn] = lambda: conn
    app.dependency_overrides[get_storage] = lambda: storage
    yield TestClient(app), conn, storage
    app.dependency_overrides.clear()


def _auth(uid: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(uid)}"}


def test_delete_removes_files_then_row(env: tuple[TestClient, FakeConn, FakeStorage]) -> None:
    client, conn, storage = env
    r = client.delete(f"/api/v1/sessions/{SA}", headers=_auth(A))
    assert r.status_code == 204
    assert SA not in conn.sessions
    assert not [p for p in storage.objects if p.startswith(f"{A}/{SA}/")]
    assert f"{A}/other-session/f3/keep.pdf" in storage.objects  # other sessions untouched
    assert ("session_deleted", A) in conn.audit


def test_user_b_cannot_delete_user_a_session(env: tuple[TestClient, FakeConn, FakeStorage]) -> None:
    client, conn, storage = env
    r = client.delete(f"/api/v1/sessions/{SA}", headers=_auth(B))
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"
    assert SA in conn.sessions
    assert f"{A}/{SA}/f1/notes.pdf" in storage.objects


def test_needs_a_token_and_a_uuid(env: tuple[TestClient, FakeConn, FakeStorage]) -> None:
    client, _, _ = env
    assert client.delete(f"/api/v1/sessions/{SA}").status_code == 401
    assert client.delete("/api/v1/sessions/..%2F..%2Fetc", headers=_auth(A)).status_code in (
        404,
        422,
    )


def test_rate_limited(env: tuple[TestClient, FakeConn, FakeStorage]) -> None:
    client, conn, _ = env
    conn.hits[(A, "session_delete")] = 30
    r = client.delete(f"/api/v1/sessions/{SA}", headers=_auth(A))
    assert r.status_code == 429 and "Retry-After" in r.headers
