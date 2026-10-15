"""Study-session lifecycle. Deleting a session removes its stored files first, then the row
(cascade clears messages, files, chunks, plans and generated content)."""

import psycopg

from app.core import audit
from app.core.errors import ApiError
from app.core.storage import Storage


def owned(conn: psycopg.Connection[dict[str, object]], user_id: str, session_id: str) -> None:
    """404 (not 403) when the session isn't the caller's, so ids can't be probed."""
    row = conn.execute(
        "select 1 from public.study_sessions where id = %s and user_id = %s",
        (session_id, user_id),
    ).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "That study session doesn't exist.")


def delete_session(
    conn: psycopg.Connection[dict[str, object]], storage: Storage, user_id: str, session_id: str
) -> int:
    owned(conn, user_id, session_id)
    prefix = f"{user_id}/{session_id}/"
    paths = storage.list_all(prefix)
    if paths:
        storage.delete(paths)
        if storage.list_all(prefix):  # verify, don't assume (SECURITY.md §7)
            raise ApiError(502, "storage_error", "Some files couldn't be removed. Try again.")
    conn.execute(
        "delete from public.study_sessions where id = %s and user_id = %s", (session_id, user_id)
    )
    audit.record(conn, "session_deleted", user_id, meta={"files": len(paths)})
    conn.commit()
    return len(paths)
