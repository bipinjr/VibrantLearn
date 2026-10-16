from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager
from functools import lru_cache

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings


@lru_cache
def _pool() -> ConnectionPool[psycopg.Connection[dict[str, object]]]:
    """One small pool per process. Opening a connection to Supabase costs ~0.9 s from India
    (TLS + auth to the Tokyo pooler); reusing one costs a round trip (~0.15 s).

    prepare_threshold=None because transaction-mode poolers can't keep prepared statements.
    Idle connections are recycled before Supavisor would drop them.
    """
    return ConnectionPool(
        get_settings().database_url.get_secret_value(),
        min_size=1,
        max_size=10,
        max_idle=120,
        max_lifetime=900,
        timeout=10,
        kwargs={"row_factory": dict_row, "prepare_threshold": None, "connect_timeout": 10},
        open=True,
    )


def get_conn() -> Iterator[psycopg.Connection[dict[str, object]]]:
    """One connection per request, borrowed from the pool and given back at the end (rolled back if
    the request left a transaction open). The API connects as a privileged role, so every query
    must filter by the acting user's id."""
    with _pool().connection() as conn:
        yield conn


def connect() -> AbstractContextManager[psycopg.Connection[dict[str, object]]]:
    return _pool().connection()


def get_connect() -> Callable[[], AbstractContextManager[psycopg.Connection[dict[str, object]]]]:
    """For streaming responses: the generator opens (and closes) its own connection, because a
    per-request dependency may be torn down before a streamed body finishes."""
    return connect
