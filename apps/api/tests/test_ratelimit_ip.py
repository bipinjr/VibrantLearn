"""A1: a spoofed x-forwarded-for must not buy a fresh rate-limit bucket."""

from collections.abc import Iterator

import pytest
from starlette.requests import Request

from app.core import ratelimit
from app.core.config import get_settings


def _req(xff: str | None, client: str = "203.0.113.7") -> Request:
    headers = [(b"x-forwarded-for", xff.encode())] if xff is not None else []
    return Request({"type": "http", "headers": headers, "client": (client, 1234)})


@pytest.fixture
def trusted(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("TRUSTED_PROXY", "true")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def fresh_settings() -> Iterator[None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_spoofed_header_ignored_without_trusted_proxy() -> None:
    assert get_settings().trusted_proxy is False
    base = ratelimit.ip_hash(_req(None))
    for spoof in ["1.1.1.1", "8.8.8.8, 9.9.9.9", "not-an-ip"]:
        assert ratelimit.ip_hash(_req(spoof)) == base


def test_trusted_proxy_uses_last_hop(trusted: None) -> None:
    # The first entry is client-supplied; the last is what our proxy saw.
    a = ratelimit.ip_hash(_req("1.1.1.1, 198.51.100.4"))
    b = ratelimit.ip_hash(_req("2.2.2.2, 198.51.100.4"))
    assert a == b
    assert a != ratelimit.ip_hash(_req("198.51.100.5"))


def test_trusted_proxy_without_header_falls_back_to_socket(trusted: None) -> None:
    assert ratelimit.client_ip(_req(None)) == "203.0.113.7"
    assert ratelimit.client_ip(_req("")) == "203.0.113.7"


def test_raw_ip_never_in_hash() -> None:
    h = ratelimit.ip_hash(_req(None))
    assert h.startswith("ip:") and "203.0.113.7" not in h
