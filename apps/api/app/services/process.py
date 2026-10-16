"""Upload steps 3-5 (SECURITY.md §8): verify the stored bytes, then extract, chunk and index.

Status moves uploaded -> scanning -> processing -> ready, or -> failed with a reason the student
can act on. A rejected file's object is deleted at once and the rejection is audit-logged.
"""

import hashlib
from typing import Any

import psycopg

from app.core import audit
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.storage import Storage
from app.files.extract import chunks, extract
from app.files.verify import FileRejectedError, check_signature

Conn = psycopg.Connection[dict[str, Any]]


def _row(conn: Conn, user_id: str, file_id: str) -> dict[str, Any]:
    row = conn.execute(
        "select id, session_id, storage_path, display_name, size_bytes, status, pages, error "
        "from public.files where id = %s and user_id = %s",
        (file_id, user_id),
    ).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "That file doesn't exist.")
    return dict(row)


def _status(conn: Conn, file_id: str, status: str, **cols: Any) -> None:
    # Column names come from this module's own keyword arguments, never from a request.
    sets = "".join(f", {k} = %s" for k in cols)
    sql = f"update public.files set status = %s, updated_at = now(){sets} where id = %s"  # noqa: S608
    conn.execute(sql, (status, *cols.values(), file_id))
    conn.commit()


def process(
    conn: Conn, storage: Storage, user_id: str, file_id: str, ocr_text: str | None = None
) -> dict[str, Any]:
    f = _row(conn, user_id, file_id)
    if f["status"] in ("ready", "failed", "scanning", "processing"):
        # Idempotent: a second call reports where the first one got to.
        return {"file_id": file_id, "status": f["status"], "pages": f["pages"], "error": f["error"]}
    path: str = f["storage_path"]
    ext = path.rsplit(".", 1)[-1].lower()
    _status(conn, file_id, "scanning")
    try:
        data = storage.download(path, max_bytes=get_settings().max_upload_mb * 1024 * 1024)
        if not data:
            raise FileRejectedError("The upload didn't arrive. Try uploading the file again.")
        if len(data) > int(f["size_bytes"]):
            raise FileRejectedError("This file is bigger than it said it was. Upload it again.")
        check_signature(data, ext)
        sha = hashlib.sha256(data).hexdigest()

        dup = conn.execute(
            "select id from public.files where session_id = %s and user_id = %s and sha256 = %s "
            "and status = 'ready' and id <> %s limit 1",
            (f["session_id"], user_id, sha, file_id),
        ).fetchone()
        if dup:  # same bytes already processed in this session: reuse them (PRD F7)
            storage.delete([path])
            conn.execute(
                "delete from public.files where id = %s and user_id = %s", (file_id, user_id)
            )
            conn.commit()
            return {"file_id": str(dup["id"]), "status": "ready", "duplicate": True}

        _status(conn, file_id, "processing", sha256=sha, size_bytes=len(data))
        doc = extract(data, ext, ocr_text)
        pieces = chunks(doc)
        with conn.cursor() as cur:
            cur.executemany(
                "insert into public.file_chunks (file_id, session_id, user_id, idx, content, page) "
                "values (%s, %s, %s, %s, %s, %s)",
                [
                    (file_id, f["session_id"], user_id, i, text, page)
                    for i, (page, text) in enumerate(pieces)
                ],
            )
        _status(conn, file_id, "ready", pages=doc.count)
        return {"file_id": file_id, "status": "ready", "pages": doc.count, "chunks": len(pieces)}
    except FileRejectedError as e:
        conn.rollback()
        storage.delete([path])
        _status(conn, file_id, "failed", error=e.message[:500])
        audit.record(conn, "upload_rejected", user_id, meta={"reason": "verify", "ext": ext})
        conn.commit()
        return {"file_id": file_id, "status": "failed", "error": e.message}


def download_url(conn: Conn, storage: Storage, user_id: str, file_id: str) -> dict[str, Any]:
    f = _row(conn, user_id, file_id)
    if f["status"] != "ready":
        raise ApiError(409, "not_ready", "This file isn't ready yet.")
    # 5 minutes, and always as an attachment: uploaded HTML/SVG is never rendered inline.
    return {
        "url": storage.signed_download_url(f["storage_path"], 300, f["display_name"]),
        "expires_in": 300,
    }


def delete_file(conn: Conn, storage: Storage, user_id: str, file_id: str) -> None:
    f = _row(conn, user_id, file_id)
    storage.delete([f["storage_path"]])
    conn.execute("delete from public.files where id = %s and user_id = %s", (file_id, user_id))
    conn.commit()
