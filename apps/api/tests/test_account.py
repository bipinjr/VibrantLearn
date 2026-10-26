"""F2/F3: real usage numbers, a full export, and account deletion that leaves nothing behind."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.auth_admin import get_auth_admin
from app.core.db import get_conn
from app.core.storage import get_storage
from app.main import app
from app.routers import me as me_router
from tests.conftest import make_token
from tests.fake_db import FakeDb
from tests.fakes import FakeStorage

A, B = str(uuid.uuid4()), str(uuid.uuid4())


class FakeAdmin:
    def __init__(self) -> None:
        self.deleted: list[str] = []

    def delete_user(self, user_id: str) -> None:
        self.deleted.append(user_id)


@pytest.fixture
def env() -> Iterator[tuple[TestClient, FakeDb, FakeStorage, FakeAdmin]]:
    db, storage, admin = FakeDb({}), FakeStorage(), FakeAdmin()
    db.state["profiles"] = {
        A: {"username": "bipin.jr", "language": "kn"},
        B: {"username": "darshan", "language": "en"},
    }
    db.state["sessions"] = {
        "s1": {"user_id": A, "title": "Java test"},
        "s2": {"user_id": B, "title": "B"},
    }
    storage.objects = {
        f"{A}/s1/f1/a.pdf": b"%PDF",
        f"{A}/s1/f2/b.png": b"x",
        f"{B}/s2/f3/c.pdf": b"%PDF",
    }
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_auth_admin] = lambda: admin
    yield TestClient(app), db, storage, admin
    app.dependency_overrides.clear()


def h(uid: str = A) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(uid)}"}


def test_usage_meter_shows_real_counts(env: Any) -> None:
    client, db, _, _ = env
    db.state["rate"][(A, "messages")] = 7
    limits = client.get("/api/v1/me", headers=h()).json()["limits"]
    assert limits["messages"]["used"] == 7 and limits["messages"]["limit"] == 30
    assert limits["plans"]["used"] == 0 and limits["uploads"]["limit"] == 20


def test_export_has_my_data_only_and_is_audited(env: Any) -> None:
    client, db, _, _ = env
    data = client.get("/api/v1/me/export", headers=h()).json()
    assert [s["title"] for s in data["sessions"]] == ["Java test"]
    assert db.state["audit"][-1]["action"] == "data_exported"


def test_delete_needs_the_typed_username(env: Any) -> None:
    client, _, storage, admin = env
    r = client.request("DELETE", "/api/v1/me", json={"confirm": "darshan"}, headers=h())
    assert r.status_code == 422
    assert admin.deleted == [] and f"{A}/s1/f1/a.pdf" in storage.objects


def test_delete_removes_every_file_then_the_account(env: Any) -> None:
    client, db, storage, admin = env
    r = client.request("DELETE", "/api/v1/me", json={"confirm": "Bipin.JR"}, headers=h())
    assert r.status_code == 204
    assert not [p for p in storage.objects if p.startswith(f"{A}/")]
    assert f"{B}/s2/f3/c.pdf" in storage.objects  # nobody else's files
    assert admin.deleted == [A]  # the cascade removes every public row (tested in SQL)
    assert db.state["audit"][-1]["action"] == "account_deleted"


def test_deletion_stops_if_files_remain(env: Any) -> None:
    client, _, storage, admin = env

    class Stuck(FakeStorage):
        def delete(self, paths: list[str]) -> None:
            pass  # storage silently keeps the objects

    stuck = Stuck()
    stuck.objects = dict(storage.objects)
    app.dependency_overrides[get_storage] = lambda: stuck
    r = client.request("DELETE", "/api/v1/me", json={"confirm": "bipin.jr"}, headers=h())
    assert (
        r.status_code == 502 and admin.deleted == []
    )  # the account is not deleted with files left


def test_shared_demo_account_cannot_be_deleted(env: Any, monkeypatch: Any) -> None:
    client, _, storage, admin = env
    monkeypatch.setattr(me_router, "is_demo_account", lambda conn, user_id: True)
    r = client.request("DELETE", "/api/v1/me", json={"confirm": "bipin.jr"}, headers=h())
    assert r.status_code == 403
    assert admin.deleted == [] and f"{A}/s1/f1/a.pdf" in storage.objects


def test_no_demo_emails_configured_skips_the_lookup() -> None:
    assert me_router.is_demo_account(None, A) is False  # type: ignore[arg-type]
