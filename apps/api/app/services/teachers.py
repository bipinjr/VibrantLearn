"""Teacher onboarding and manual verification (TEACHER.md T1).

- Subjects come from the syllabus tables, never free text.
- The certificate or college ID goes to the private bucket under the teacher's own folder through a
  server-signed upload URL, and is judged by its bytes (verify.check_signature) before it counts.
- Payout details live in internal.teacher_payout_details and only ever leave the API masked.
- Reviewers (internal.reviewers, added by SQL) approve or reject with a reason the teacher sees.
"""

import re
import secrets
from typing import Any

from app.core import audit
from app.core.errors import ApiError
from app.core.storage import Storage
from app.files.verify import FileRejectedError, check_signature
from app.services.classes import Conn, teacher

DOC_EXTS = ("pdf", "jpg", "jpeg", "png")
DOC_MAX_BYTES = 5 * 1024 * 1024
REVIEW_PROMISE = "Under review, usually within 2 days."


def subjects(conn: Conn) -> list[str]:
    rows = conn.execute("select distinct subject from public.syllabi order by subject").fetchall()
    return [str(r["subject"]) for r in rows]


def check_subjects(conn: Conn, picked: list[str]) -> None:
    unknown = sorted(set(picked) - set(subjects(conn)))
    if unknown:
        raise ApiError(
            422,
            "invalid_input",
            f"Pick subjects from the list. Not in the syllabus: {', '.join(unknown)}.",
        )


def _doc_path_ok(user_id: str, path: str) -> str:
    m = re.fullmatch(rf"{re.escape(user_id)}/teacher/[0-9a-f]{{32}}\.({'|'.join(DOC_EXTS)})", path)
    if not m:
        raise ApiError(404, "not_found", "That upload doesn't exist.")
    return m.group(1)


def document_upload_url(conn: Conn, storage: Storage, user_id: str, ext: str) -> dict[str, str]:
    if not teacher(conn, user_id):
        raise ApiError(
            409, "no_profile", "Save your teacher profile first, then upload the document."
        )
    path = f"{user_id}/teacher/{secrets.token_hex(16)}.{ext}"
    return {"upload_url": storage.signed_upload_url(path), "path": path}


DOC_KINDS = ("degree", "staff_id", "net_set", "bed", "tet", "other")


def document_confirm(
    conn: Conn, storage: Storage, user_id: str, path: str, kind: str = "degree"
) -> dict[str, Any]:
    ext = _doc_path_ok(user_id, path)
    data = storage.download(path, DOC_MAX_BYTES + 1)
    try:
        if len(data) > DOC_MAX_BYTES:
            raise FileRejectedError("That file is over 5 MB. Upload a smaller scan or photo.")
        check_signature(data, ext)
    except FileRejectedError:
        storage.delete([path])
        raise
    old = conn.execute(
        "select path from internal.teacher_documents where user_id = %s and kind = %s",
        (user_id, kind),
    ).fetchone()
    conn.execute(
        "insert into internal.teacher_documents (user_id, kind, path) values (%s, %s, %s) "
        "on conflict (user_id, kind) do update set path = excluded.path, created_at = now()",
        (user_id, kind, path),
    )
    if kind == "degree":
        conn.execute(
            "update public.teachers set document_path = %s where user_id = %s", (path, user_id)
        )
    conn.commit()
    if old and old["path"] != path:
        storage.delete([str(old["path"])])
    return {"documents": documents(conn, user_id)}


def documents(conn: Conn, user_id: str) -> list[dict[str, str]]:
    rows = conn.execute(
        "select kind, created_at from internal.teacher_documents where user_id = %s order by kind",
        (user_id,),
    ).fetchall()
    return [{"kind": str(r["kind"]), "uploaded_at": r["created_at"].isoformat()} for r in rows]


def set_payout(conn: Conn, user_id: str, d: dict[str, Any]) -> dict[str, str]:
    if not teacher(conn, user_id):
        raise ApiError(409, "no_profile", "Save your teacher profile first.")
    upi = d.get("upi_id") if d["method"] == "upi" else None
    bank = (
        (d.get("account_name"), d.get("account_number"), d.get("ifsc"))
        if d["method"] == "bank"
        else (None, None, None)
    )
    conn.execute(
        "insert into internal.teacher_payout_details (user_id, method, upi_id, account_name, account_number, ifsc) "
        "values (%s, %s, %s, %s, %s, %s) on conflict (user_id) do update set method = excluded.method, "
        "upi_id = excluded.upi_id, account_name = excluded.account_name, account_number = excluded.account_number, "
        "ifsc = excluded.ifsc, updated_at = now()",
        (user_id, d["method"], upi, *bank),
    )
    conn.commit()
    p = payout_masked(conn, user_id)
    assert p is not None
    return p


def payout_masked(conn: Conn, user_id: str) -> dict[str, str] | None:
    r = conn.execute(
        "select method, upi_id, account_number, ifsc from internal.teacher_payout_details where user_id = %s",
        (user_id,),
    ).fetchone()
    if not r:
        return None
    if r["method"] == "upi":
        name, _, bank = str(r["upi_id"]).partition("@")
        return {"method": "upi", "display": f"{name[:2]}{'•' * max(1, len(name) - 2)}@{bank}"}
    return {
        "method": "bank",
        "display": f"Account ending {str(r['account_number'])[-4:]}, {r['ifsc']}",
    }


def is_reviewer(conn: Conn, user_id: str) -> bool:
    return (
        conn.execute("select 1 from internal.reviewers where user_id = %s", (user_id,)).fetchone()
        is not None
    )


def _reviewer(conn: Conn, user_id: str) -> None:
    if not is_reviewer(conn, user_id):
        raise ApiError(404, "not_found", "Not found.")  # don't reveal the review queue exists


def queue(conn: Conn, storage: Storage, user_id: str) -> list[dict[str, Any]]:
    _reviewer(conn, user_id)
    rows = conn.execute(
        "select t.user_id, t.display_name, t.organisation, t.qualification, t.experience_years, t.subjects, t.bio, "
        "t.status, t.document_path, t.submitted_at, t.review_note, t.institution_code, u.email "
        "from public.teachers t join auth.users u on u.id = t.user_id "
        "where t.status in ('pending', 'rejected') order by t.submitted_at nulls last limit 100"
    ).fetchall()
    out = []
    for r in rows:
        docs = conn.execute(
            "select kind, path from internal.teacher_documents where user_id = %s order by kind",
            (r["user_id"],),
        ).fetchall()
        doc = r["document_path"]
        out.append(
            {
                "user_id": str(r["user_id"]),
                "display_name": r["display_name"],
                "email": r["email"],
                "organisation": r["organisation"],
                "qualification": r["qualification"],
                "experience_years": r["experience_years"],
                "subjects": r["subjects"],
                "bio": r["bio"],
                "status": r["status"],
                "review_note": r["review_note"],
                "submitted_at": r["submitted_at"].isoformat() if r["submitted_at"] else None,
                "document_url": storage.signed_download_url(
                    str(doc), 600, f"document.{str(doc).rsplit('.', 1)[1]}"
                )
                if doc
                else None,
                "institution_code": r["institution_code"],
                "documents": [
                    {
                        "kind": str(d["kind"]),
                        "url": storage.signed_download_url(
                            str(d["path"]), 600, f"{d['kind']}.{str(d['path']).rsplit('.', 1)[1]}"
                        ),
                    }
                    for d in docs
                ],
            }
        )
    return out


def review(conn: Conn, reviewer_id: str, user_id: str, decision: str, note: str) -> dict[str, Any]:
    _reviewer(conn, reviewer_id)
    t = teacher(conn, user_id)
    if not t:
        raise ApiError(404, "not_found", "No such teacher.")
    if decision == "reject" and not note:
        raise ApiError(422, "invalid_input", "Say why, so the teacher can fix it.")
    status = "verified" if decision == "verify" else "rejected"
    conn.execute(
        "update public.teachers set status = %s, reviewed_at = now(), review_note = %s, "
        "verified_at = case when %s = 'verified' then now() else verified_at end where user_id = %s",
        (status, note or None, status, user_id),
    )
    audit.record(conn, f"teacher_{status}", reviewer_id, meta={"teacher": user_id})
    conn.commit()
    return {"status": status}
