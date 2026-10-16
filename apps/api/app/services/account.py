"""The student's own account: usage meter (F2), data export, and deletion (F3).

Deletion order matters: every stored file first (verified gone), then the auth user, whose
deletion cascades to every row in public.*. If the auth call fails the student can simply retry;
nothing is left half-deleted that a retry wouldn't finish.
"""

from datetime import UTC, datetime
from typing import Any

import psycopg

from app.core import audit
from app.core.auth_admin import AuthAdmin
from app.core.errors import ApiError
from app.core.storage import Storage
from app.services.files import DAILY_BYTES, DAILY_FILES, _today_start

Conn = psycopg.Connection[dict[str, Any]]

# bucket -> (limit, window seconds); the same numbers the limits are enforced with.
BUCKETS = {"messages": (30, 600), "plans": (10, 3600), "content": (40, 3600)}


def usage(conn: Conn, user_id: str, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    out: dict[str, Any] = {}
    for bucket, (limit, window) in BUCKETS.items():
        row = conn.execute(
            "select count, window_start + make_interval(secs => %(w)s) as resets_at "
            "from internal.rate_limits where subject = %(s)s and bucket = %(b)s "
            "and window_start = to_timestamp(floor(extract(epoch from now()) / %(w)s) * %(w)s)",
            {"s": user_id, "b": bucket, "w": window},
        ).fetchone()
        out[bucket] = {
            "used": min(limit, int(row["count"])) if row else 0,
            "limit": limit,
            "resets_at": row["resets_at"].isoformat() if row else None,
        }
    up = conn.execute(
        "select count(*) as n, coalesce(sum(size_bytes), 0) as bytes from public.files "
        "where user_id = %s and created_at >= %s",
        (user_id, _today_start(now)),
    ).fetchone()
    out["uploads"] = {
        "used": int(up["n"]) if up else 0,
        "limit": DAILY_FILES,
        "bytes_used": int(up["bytes"]) if up else 0,
        "bytes_limit": DAILY_BYTES,
    }
    return out


# section -> (table, columns). Table and column names are ours; only the user id is a parameter.
_EXPORT = {
    "sessions": ("study_sessions", "id, title, subject, deadline_at, mode, created_at, updated_at"),
    "messages": ("messages", "id, session_id, role, content, blocks, served_from, created_at"),
    "plans": ("study_plans", "id, session_id, subject, deadline_at, mode, hours_available, plan"),
    "checkpoints": ("plan_checkpoints", "plan_id, ord, title, due_at, done_at"),
    "generated_content": ("generated_content", "id, kind, topic, language, payload, created_at"),
    "quiz_attempts": ("quiz_attempts", "content_id, answers, score, total, created_at"),
    "flashcard_reviews": ("flashcard_reviews", "content_id, card_idx, box, next_due_at"),
    "files": ("files", "id, session_id, display_name, mime, size_bytes, status, pages, created_at"),
}


def export(conn: Conn, user_id: str) -> dict[str, Any]:
    """Everything we hold about the student, as JSON (DPDP access/portability). File bytes are not
    included; each file can be downloaded from its own row."""
    profile = conn.execute(
        "select username::text, full_name, university, course, semester, scheme, language, style, "
        "formats, consent_at, onboarded_at, created_at from public.profiles where id = %s",
        (user_id,),
    ).fetchone()
    data: dict[str, Any] = {"exported_at": datetime.now(UTC).isoformat(), "profile": profile}
    for name, (table, cols) in _EXPORT.items():
        sql = f"select {cols} from public.{table} where user_id = %s order by created_at"  # noqa: S608
        data[name] = conn.execute(
            sql if "created_at" in cols else sql.split(" order by")[0], (user_id,)
        ).fetchall()
    audit.record(conn, "data_exported", user_id)
    conn.commit()
    return data


def delete_account(
    conn: Conn, storage: Storage, admin: AuthAdmin, user_id: str, confirm: str
) -> None:
    row = conn.execute(
        "select username::text as username from public.profiles where id = %s", (user_id,)
    ).fetchone()
    if row is None or confirm.strip().lower() != str(row["username"]).lower():
        raise ApiError(422, "invalid_input", "Type your username exactly to confirm.")
    prefix = f"{user_id}/"
    paths = storage.list_all(prefix)
    if paths:
        storage.delete(paths)
        if storage.list_all(prefix):
            raise ApiError(
                502, "storage_error", "Some of your files couldn't be removed. Try again."
            )
    admin.delete_user(user_id)  # cascades to every public.* row
    audit.record(conn, "account_deleted", user_id, meta={"files": len(paths)})
    conn.commit()
