"""internal.audit_log writer (SECURITY.md §13).

Never log file contents, chat text, tokens or raw IPs.
"""

import psycopg
from psycopg.types.json import Jsonb


def record(
    conn: psycopg.Connection[dict[str, object]],
    action: str,
    user_id: str | None,
    ip_hash: str | None = None,
    meta: dict[str, object] | None = None,
) -> None:
    conn.execute(
        "insert into internal.audit_log (user_id, action, ip_hash, meta) values (%s, %s, %s, %s)",
        (user_id, action, ip_hash, Jsonb(meta or {})),
    )
