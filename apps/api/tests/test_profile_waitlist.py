"""Endpoint tests against the local Supabase DB (skipped when it isn't running)."""

import uuid
from collections.abc import Callable

import psycopg
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_token

client = TestClient(app)
MakeUser = Callable[[], str]


def _auth(uid: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(uid)}", "x-forwarded-for": str(uuid.uuid4())}


def test_endpoints_need_a_token() -> None:
    assert client.patch("/api/v1/me", json={}).status_code == 401
    assert client.get("/api/v1/usernames/available?u=abc").status_code == 401


def test_profile_needs_username_and_consent(make_user: MakeUser) -> None:
    a = make_user()
    r = client.patch("/api/v1/me", json={"username": "first.user"}, headers=_auth(a))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "consent_required"


def test_onboarding_flow_and_uniqueness(make_user: MakeUser) -> None:
    a, b = make_user(), make_user()
    name = f"bipin.{uuid.uuid4().hex[:6]}"
    r = client.patch("/api/v1/me", json={"username": name, "consent": True}, headers=_auth(a))
    assert r.status_code == 200, r.text
    assert r.json()["profile"]["username"] == name

    # case-insensitive clash for user B
    r = client.patch(
        "/api/v1/me", json={"username": name.upper(), "consent": True}, headers=_auth(b)
    )
    assert r.status_code == 409

    r = client.get(f"/api/v1/usernames/available?u={name.upper()}", headers=_auth(b))
    assert r.json()["available"] is False
    r = client.get(f"/api/v1/usernames/available?u={name}", headers=_auth(a))
    assert r.json()["available"] is True  # your own name is "available" to you

    r = client.patch(
        "/api/v1/me",
        json={
            "course": "BCA",
            "semester": 3,
            "scheme": "SEP",
            "language": "kn",
            "formats": ["quiz", "quiz", "notes"],
            "finish_onboarding": True,
        },
        headers=_auth(a),
    )
    p = r.json()["profile"]
    assert (p["language"], p["formats"], p["onboarded"]) == ("kn", ["notes", "quiz"], True)


def test_profile_rejects_bad_input(make_user: MakeUser) -> None:
    a = make_user()
    for body in (
        {"username": "admin", "consent": True},
        {"username": "a..b", "consent": True},
        {"language": "fr"},
        {"user_id": "someone-else"},
        {"formats": ["memes"]},
    ):
        assert client.patch("/api/v1/me", json=body, headers=_auth(a)).status_code == 422, body


def test_waitlist_double_submit_and_limit(db: psycopg.Connection[tuple[object, ...]]) -> None:
    email = f"{uuid.uuid4().hex[:8]}@college.edu"
    ip = {"x-forwarded-for": str(uuid.uuid4())}
    for _ in range(2):
        assert client.post("/api/v1/waitlist", json={"email": email}, headers=ip).status_code == 202
    row = db.execute("select count(*) from public.waitlist where email = %s", (email,)).fetchone()
    assert row == (1,)
    for _ in range(3):
        client.post("/api/v1/waitlist", json={"email": email}, headers=ip)
    r = client.post("/api/v1/waitlist", json={"email": email}, headers=ip)
    assert r.status_code == 429 and "retry-after" in r.headers
    db.execute("delete from public.waitlist where email = %s", (email,))
    db.commit()


def test_waitlist_rejects_bad_email(db: psycopg.Connection[tuple[object, ...]]) -> None:
    # The DB connection opens before body validation, so this needs the DB up too.
    r = client.post("/api/v1/waitlist", json={"email": "<script>@x"})
    assert r.status_code == 422
