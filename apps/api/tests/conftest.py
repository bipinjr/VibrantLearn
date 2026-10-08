"""Test helpers: sign tokens with a throwaway EC key and point the verifier at it."""

import time
import uuid
from collections.abc import Iterator
from types import SimpleNamespace

import jwt
import psycopg
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.core import auth
from app.core.config import get_settings

_KEY = ec.generate_private_key(ec.SECP256R1())


class _FakeJwks:
    def get_signing_key_from_jwt(self, token: str) -> SimpleNamespace:
        return SimpleNamespace(key=_KEY.public_key())


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth, "_jwks", lambda: _FakeJwks())


def make_token(sub: str, **overrides: object) -> str:
    now = int(time.time())
    claims: dict[str, object] = {
        "sub": sub,
        "aud": "authenticated",
        "role": "authenticated",
        "iss": get_settings().jwt_issuer,
        "iat": now,
        "exp": now + 600,
    }
    claims.update(overrides)
    return jwt.encode(claims, _KEY, algorithm="ES256")


@pytest.fixture
def db() -> Iterator[psycopg.Connection[tuple[object, ...]]]:
    try:
        conn = psycopg.connect(get_settings().database_url.get_secret_value(), connect_timeout=2)
    except psycopg.OperationalError:
        pytest.skip("local Supabase not running (npx supabase start)")
    with conn:
        yield conn


@pytest.fixture
def make_user(db: psycopg.Connection[tuple[object, ...]]) -> Iterator[object]:
    made: list[str] = []

    def _make() -> str:
        uid = str(uuid.uuid4())
        db.execute("insert into auth.users (id, email) values (%s, %s)", (uid, f"{uid}@test.local"))
        db.commit()
        made.append(uid)
        return uid

    yield _make
    for uid in made:
        db.execute("delete from auth.users where id = %s", (uid,))
    db.commit()
