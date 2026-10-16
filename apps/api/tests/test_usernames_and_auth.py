import time

import pytest

from app.core.auth import verify_token
from app.core.errors import ApiError
from app.services.usernames import problem
from tests.conftest import make_token

UID = "00000000-0000-0000-0000-0000000000aa"


@pytest.mark.parametrize("name", ["bipin.jr", "abc", "a|b|c", "Darshan.HS", "x" * 30, "bca2026"])
def test_valid_usernames(name: str) -> None:
    assert problem(name) is None


@pytest.mark.parametrize(
    "name",
    [
        "ab",
        "x" * 31,
        ".abc",
        "abc.",
        "|abc",
        "a..b",
        "a||b",
        "a b",
        "a_b",
        "<b>",
        "ಕನ್ನಡ",
        "admin",
        "ADMIN",
        "v.ibrantlearn",
        "support",
        "root",
    ],
)
def test_invalid_usernames(name: str) -> None:
    assert problem(name) is not None


def test_valid_token() -> None:
    assert verify_token(make_token(UID)).id == UID


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "something-else"},
        {"iss": "https://evil.example/auth/v1"},
        {"exp": int(time.time()) - 60},  # past the 30 s clock leeway
        {"role": "anon"},
        {"is_anonymous": True},
    ],
)
def test_rejected_tokens(overrides: dict[str, object]) -> None:
    with pytest.raises(ApiError) as e:
        verify_token(make_token(UID, **overrides))
    assert e.value.status == 401


def test_garbage_token() -> None:
    with pytest.raises(ApiError):
        verify_token("not.a.jwt")
