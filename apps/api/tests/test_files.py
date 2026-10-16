"""C1: signed upload URLs are only handed out for files we're willing to store."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.db import get_conn
from app.core.storage import get_storage
from app.main import app
from tests.conftest import make_token
from tests.fake_db import FakeDb
from tests.fakes import FakeStorage

A, B = str(uuid.uuid4()), str(uuid.uuid4())
SA, SB = str(uuid.uuid4()), str(uuid.uuid4())
MB = 1024 * 1024


@pytest.fixture
def env() -> Iterator[tuple[TestClient, FakeDb, FakeStorage]]:
    db, storage = FakeDb({}), FakeStorage()
    db.state["sessions"] = {SA: {"user_id": A}, SB: {"user_id": B}}
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_storage] = lambda: storage
    yield TestClient(app), db, storage
    app.dependency_overrides.clear()


def ask(client: TestClient, name: str, size: int, uid: str = A, sid: str = SA) -> Any:
    return client.post(
        f"/api/v1/sessions/{sid}/files/upload-url",
        json={"name": name, "mime": "application/pdf", "size_bytes": size},
        headers={"Authorization": f"Bearer {make_token(uid)}"},
    )


def test_49_mb_pdf_gets_a_one_time_url_into_its_own_folder(
    env: tuple[TestClient, FakeDb, FakeStorage],
) -> None:
    client, db, storage = env
    r = ask(client, "Unit 3 – Inheritance (final).pdf", 49 * MB)  # noqa: RUF001 - a real en dash, on purpose
    assert r.status_code == 201
    body = r.json()
    assert body["path"] == f"{A}/{SA}/{body['file_id']}/unit-3-inheritance-final.pdf"
    assert body["content_type"] == "application/pdf"
    assert storage.signed == [body["path"]]
    row = db.state["files"][0]
    assert row["status"] == "uploaded" and row["name"] == "Unit 3 – Inheritance (final).pdf"  # noqa: RUF001 - a real en dash, on purpose


def test_51_mb_is_refused_with_the_split_it_message(
    env: tuple[TestClient, FakeDb, FakeStorage],
) -> None:
    client, db, storage = env
    r = ask(client, "big.pdf", 51 * MB)
    assert r.status_code == 413
    assert "Split it into parts" in r.json()["error"]["message"]
    assert db.state["files"] == [] and storage.signed == []
    assert db.state["audit"][0]["action"] == "upload_rejected"


@pytest.mark.parametrize(
    ("name", "status"),
    [
        ("evil.exe", 415),
        ("notes.pdf.exe", 415),
        ("noextension", 415),
        ("../../etc/passwd.pdf", 422),
        ("a\b.pdf", 422),
        ("bad\x00name.pdf", 422),
        ("x" * 118 + ".pdf", 422),
    ],
)
def test_names_and_types_we_never_store(
    env: tuple[TestClient, FakeDb, FakeStorage], name: str, status: int
) -> None:
    client, db, _ = env
    r = ask(client, name, 1000)
    assert r.status_code == status
    assert db.state["files"] == []


def test_code_is_stored_as_plain_text_and_kannada_names_get_a_safe_slug(
    env: tuple[TestClient, FakeDb, FakeStorage],
) -> None:
    client, _, _ = env
    assert ask(client, "lab_program.ts", 900).json()["content_type"] == "text/plain"
    assert ask(client, "ಜಾವಾ ನೋಟ್ಸ್.pdf", 900).json()["path"].endswith("/file.pdf")


def test_cannot_upload_into_another_students_session(
    env: tuple[TestClient, FakeDb, FakeStorage],
) -> None:
    client, db, storage = env
    assert ask(client, "notes.pdf", 1000, uid=A, sid=SB).status_code == 404
    assert db.state["files"] == [] and storage.signed == []


def test_daily_quota_says_when_it_resets(env: tuple[TestClient, FakeDb, FakeStorage]) -> None:
    client, _, _ = env
    for i in range(20):
        assert ask(client, f"part{i}.pdf", 1000).status_code == 201
    r = ask(client, "one-more.pdf", 1000)
    assert r.status_code == 429
    assert (
        "resets at 12:00 AM" in r.json()["error"]["message"] and int(r.headers["Retry-After"]) > 0
    )


def test_daily_byte_quota(env: tuple[TestClient, FakeDb, FakeStorage]) -> None:
    client, _, _ = env
    for i in range(6):
        assert ask(client, f"big{i}.pdf", 49 * MB).status_code == 201
    assert ask(client, "last.pdf", 10 * MB).status_code == 429  # 294 + 10 > 300 MB


def test_body_is_strict(env: tuple[TestClient, FakeDb, FakeStorage]) -> None:
    client, _, _ = env
    r = client.post(
        f"/api/v1/sessions/{SA}/files/upload-url",
        json={"name": "a.pdf", "size_bytes": 10, "path": "../x"},
        headers={"Authorization": f"Bearer {make_token(A)}"},
    )
    assert r.status_code == 422
