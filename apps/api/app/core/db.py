from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager

import psycopg
from psycopg.rows import dict_row

from app.core.config import get_settings


def get_conn() -> Iterator[psycopg.Connection[dict[str, object]]]:
    """One connection per request; Supavisor (transaction mode) does the pooling in prod.

    prepare_threshold=None because transaction-mode poolers can't keep prepared statements.
    The API connects as a privileged role, so every query must filter by the acting user's id.
    """
    url = get_settings().database_url.get_secret_value()
    with psycopg.connect(
        url, row_factory=dict_row, prepare_threshold=None, connect_timeout=5
    ) as conn:
        yield conn


def connect() -> AbstractContextManager[psycopg.Connection[dict[str, object]]]:
    url = get_settings().database_url.get_secret_value()
    return psycopg.connect(url, row_factory=dict_row, prepare_threshold=None, connect_timeout=5)


def get_connect() -> Callable[[], AbstractContextManager[psycopg.Connection[dict[str, object]]]]:
    """For streaming responses: the generator opens (and closes) its own connection, because a
    per-request dependency may be torn down before a streamed body finishes."""
    return connect
