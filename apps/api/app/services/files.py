"""Upload step 1 (SECURITY.md §8): check what the browser *declares*, before any byte is stored.

The declared name, type and size are only claims. The bytes are verified in process.py (magic
bytes, real size, SHA-256) before anything trusts them. What this step decides:
- the extension is on the allowlist (PRD F7),
- the size is within MAX_UPLOAD_MB and today's quota,
- a safe storage name, never the student's raw file name,
- the content type Storage will record, chosen by the server from the extension.
"""

import re
import unicodedata
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import psycopg

from app.core import audit
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.storage import Storage

Conn = psycopg.Connection[dict[str, Any]]

# Extension -> the content type stored. Text and code are stored as text/plain: they are always
# downloaded, never rendered, and browsers report unreliable types for them (.ts as video/mp2t).
STORED_TYPE: dict[str, str] = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    **{
        ext: "text/plain"
        for ext in (
            "txt",
            "md",
            "csv",
            "json",
            "xml",
            "html",
            "css",
            "js",
            "ts",
            "py",
            "java",
            "c",
            "cpp",
        )
    },
}
DAILY_FILES = 20
DAILY_BYTES = 300 * 1024 * 1024
IST = timedelta(minutes=330)
_CONTROL = re.compile(r"[\x00-\x1f\x7f-\x9f]")


def too_big_message(limit_mb: int) -> str:
    return (
        f"This file is over {limit_mb} MB. Split it into parts "
        "(for example by chapter) and upload each part."
    )


def check_name(name: str) -> tuple[str, str]:
    """(display name, extension). Rejects path tricks, control characters and long names."""
    if not name or len(name) > 120:
        raise ApiError(422, "invalid_input", "Use a file name of 120 characters or fewer.")
    if "/" in name or "\\" in name or _CONTROL.search(name) or name in (".", ".."):
        raise ApiError(
            422,
            "invalid_input",
            "That file name has characters we can't store. Rename it and try again.",
        )
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in STORED_TYPE:
        raise ApiError(
            415,
            "unsupported_type",
            "This file type isn't supported. Upload PDF, Word, PowerPoint, text, code or images.",
        )
    return name.strip(), ext


def safe_name(name: str, ext: str) -> str:
    """ASCII slug + extension for the storage path. The original name is kept only for display."""
    stem = name[: -(len(ext) + 1)]
    ascii_stem = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_stem.lower()).strip("-")[:60] or "file"
    return f"{slug}.{ext}"


def _today_start(now: datetime) -> datetime:
    """Midnight in India, so "resets at 12:00 AM" means the student's midnight."""
    local = (now + IST).date()
    return datetime(local.year, local.month, local.day, tzinfo=UTC) - IST


def create_upload(
    conn: Conn,
    storage: Storage,
    user_id: str,
    session_id: str,
    name: str,
    size_bytes: int,
    now: datetime | None = None,
) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    limit_mb = get_settings().max_upload_mb
    display, ext = check_name(name)
    if size_bytes > limit_mb * 1024 * 1024:
        audit.record(
            conn, "upload_rejected", user_id, meta={"reason": "too_large", "bytes": size_bytes}
        )
        conn.commit()
        raise ApiError(413, "file_too_large", too_big_message(limit_mb))

    used = conn.execute(
        "select count(*) as n, coalesce(sum(size_bytes), 0) as bytes from public.files "
        "where user_id = %s and created_at >= %s",
        (user_id, _today_start(now)),
    ).fetchone()
    n, used_bytes = (int(used["n"]), int(used["bytes"])) if used else (0, 0)
    if n >= DAILY_FILES or used_bytes + size_bytes > DAILY_BYTES:
        audit.record(conn, "upload_rejected", user_id, meta={"reason": "daily_quota"})
        conn.commit()
        why = "20 files" if n >= DAILY_FILES else "300 MB of uploads"
        raise ApiError(
            429,
            "rate_limited",
            f"You've hit today's limit of {why}. It resets at 12:00 AM.",
            headers={
                "Retry-After": str(
                    int((_today_start(now) + timedelta(days=1) - now).total_seconds())
                )
            },
        )

    file_id = str(uuid.uuid4())
    path = f"{user_id}/{session_id}/{file_id}/{safe_name(display, ext)}"
    conn.execute(
        "insert into public.files (id, session_id, user_id, storage_path, original_name, "
        "display_name, mime, size_bytes, status) "
        "values (%s, %s, %s, %s, %s, %s, %s, %s, 'uploaded')",
        (file_id, session_id, user_id, path, display, display, STORED_TYPE[ext], size_bytes),
    )
    url = storage.signed_upload_url(path)
    conn.commit()
    return {
        "file_id": file_id,
        "upload_url": url,
        "content_type": STORED_TYPE[ext],
        "expires_in": 7200,  # Supabase signed upload URLs last two hours
        "path": path,
    }
