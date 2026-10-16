from typing import Annotated, Literal

import psycopg
from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core import ratelimit
from app.core.auth import CurrentUser
from app.core.auth_admin import AuthAdmin, get_auth_admin
from app.core.db import get_conn
from app.core.errors import ApiError
from app.core.storage import Storage, get_storage
from app.services import account, usernames

router = APIRouter()
Conn = Annotated[psycopg.Connection[dict[str, object]], Depends(get_conn)]

Format = Literal["quiz", "flashcards", "notes", "important_questions", "pyq", "timetable"]


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    username: str | None = Field(default=None, max_length=30)
    consent: bool | None = None
    full_name: str | None = Field(default=None, max_length=100)
    university: str | None = Field(default=None, min_length=2, max_length=120)
    course: Literal["BCA", "BCom", "BSc", "PU", "Other"] | None = None
    semester: int | None = Field(default=None, ge=1, le=10)
    scheme: Literal["SEP", "NEP", "Other"] | None = None
    language: Literal["en", "kn", "hi"] | None = None
    style: Literal["short", "detailed"] | None = None
    formats: list[Format] | None = Field(default=None, max_length=6)
    finish_onboarding: bool | None = None

    @field_validator("username")
    @classmethod
    def _username(cls, v: str | None) -> str | None:
        if v is not None and (msg := usernames.problem(v)):
            raise ValueError(msg)
        return v


_COLUMNS = (
    "username",
    "full_name",
    "university",
    "course",
    "semester",
    "scheme",
    "language",
    "style",
    "formats",
)


@router.get("/usernames/available")
def username_available(
    user: CurrentUser,
    conn: Conn,
    u: Annotated[str, Query(max_length=30)],
) -> dict[str, object]:
    # Keyed by user id, not IP: x-forwarded-for is attacker-controlled off Vercel, and behind the
    # Next rewrite every student can share one source address (SECURITY.md §11).
    ratelimit.hit(
        conn,
        f"user:{user.id}",
        "username_check",
        30,
        60,
        "Too many checks in a minute. Wait a moment and try again.",
    )
    if msg := usernames.problem(u):
        return {"available": False, "reason": msg}
    row = conn.execute(
        "select 1 from public.profiles where username = %s and id <> %s", (u, user.id)
    ).fetchone()
    return {"available": row is None, "reason": None if row is None else "That name is taken."}


@router.patch("/me")
def update_me(body: ProfilePatch, user: CurrentUser, conn: Conn) -> dict[str, object]:
    data = body.model_dump(exclude_none=True)
    fields = {k: data[k] for k in _COLUMNS if k in data}
    if "formats" in fields:
        fields["formats"] = sorted(set(fields["formats"]))

    exists = conn.execute("select 1 from public.profiles where id = %s", (user.id,)).fetchone()
    if not exists and (not body.username or body.consent is not True):
        raise ApiError(
            422, "consent_required", "Pick a username and accept the privacy notice to continue."
        )

    stamps = []
    if body.consent:
        stamps.append("consent_at = coalesce(profiles.consent_at, now())")
    if body.finish_onboarding:
        stamps.append("onboarded_at = coalesce(profiles.onboarded_at, now())")

    cols = list(fields)
    # Column names come from the fixed _COLUMNS allowlist; values are always parameters.
    insert_cols = ", ".join(["id", *cols, "consent_at"])
    insert_vals = ", ".join(["%(id)s", *[f"%({c})s" for c in cols], "now()"])
    updates = ", ".join([f"{c} = excluded.{c}" for c in cols] + stamps) or "id = profiles.id"
    sql = (
        f"insert into public.profiles as profiles ({insert_cols}) values ({insert_vals}) "  # noqa: S608
        f"on conflict (id) do update set {updates} "
        "returning username::text, full_name, university, course, semester, scheme, language, "
        "style, formats, onboarded_at is not null as onboarded"
    )
    try:
        row = conn.execute(sql, {"id": user.id, **fields}).fetchone()
        conn.commit()
    except psycopg.errors.UniqueViolation as e:
        raise ApiError(409, "username_taken", "That name is taken. Try another.") from e
    return {"profile": row}


@router.get("/me")
def get_me(user: CurrentUser, conn: Conn) -> dict[str, object]:
    """Profile plus the student's real remaining allowances (the Settings usage meter)."""
    profile = conn.execute(
        "select username::text, full_name, university, course, semester, scheme, language, style, "
        "formats, onboarded_at is not null as onboarded from public.profiles where id = %s",
        (user.id,),
    ).fetchone()
    return {"profile": profile, "limits": account.usage(conn, user.id)}


@router.get("/me/export")
def export_me(user: CurrentUser, conn: Conn) -> dict[str, object]:
    ratelimit.hit(conn, user.id, "export", 5, 3600, "Exports are limited to 5 an hour.")
    return account.export(conn, user.id)


class DeleteMe(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirm: str = Field(min_length=1, max_length=30)  # the student's username, typed


@router.delete("/me", status_code=204)
def delete_me(
    body: DeleteMe,
    user: CurrentUser,
    conn: Conn,
    storage: Annotated[Storage, Depends(get_storage)],
    admin: Annotated[AuthAdmin, Depends(get_auth_admin)],
) -> Response:
    ratelimit.hit(conn, user.id, "delete_account", 5, 3600, "Too many attempts. Wait a bit.")
    account.delete_account(conn, storage, admin, user.id, body.confirm)
    return Response(status_code=204)
