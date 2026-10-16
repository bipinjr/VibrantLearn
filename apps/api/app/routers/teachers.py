"""Teacher onboarding (TEACHER.md T1): subjects, review document, payout details, review queue."""

from typing import Annotated, Any, Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.core import ratelimit
from app.core.auth import CurrentUser
from app.core.db import get_conn
from app.core.errors import ApiError
from app.core.storage import Storage, get_storage
from app.services import teachers

router = APIRouter()
Conn = Annotated[psycopg.Connection[dict[str, object]], Depends(get_conn)]
Store = Annotated[Storage, Depends(get_storage)]


class DocUrlIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ext: Literal["pdf", "jpg", "jpeg", "png"]


class DocIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str = Field(max_length=200)


class PayoutIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    method: Literal["upi", "bank"]
    upi_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9._-]{2,255}@[A-Za-z]{2,64}$")
    account_name: str | None = Field(default=None, min_length=2, max_length=80)
    account_number: str | None = Field(default=None, pattern=r"^[0-9]{9,18}$")
    ifsc: str | None = Field(default=None, pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")


class ReviewIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    decision: Literal["verify", "reject"]
    note: str = Field(default="", max_length=300)


@router.get("/teachers/subjects")
def list_subjects(user: CurrentUser, conn: Conn) -> dict[str, Any]:
    return {"subjects": teachers.subjects(conn)}


@router.post("/teachers/document/upload-url")
def document_upload_url(
    body: DocUrlIn, user: CurrentUser, conn: Conn, storage: Store
) -> dict[str, str]:
    ratelimit.hit(conn, user.id, "teacher_doc", 10, 86400, "Too many uploads today.")
    return teachers.document_upload_url(conn, storage, user.id, body.ext)


@router.post("/teachers/document")
def document_confirm(body: DocIn, user: CurrentUser, conn: Conn, storage: Store) -> dict[str, Any]:
    return teachers.document_confirm(conn, storage, user.id, body.path)


@router.put("/teachers/payout")
def set_payout(body: PayoutIn, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    if body.method == "upi" and not body.upi_id:
        raise ApiError(422, "invalid_input", "Enter your UPI ID, like name@okaxis.")
    if body.method == "bank" and not (body.account_name and body.account_number and body.ifsc):
        raise ApiError(
            422, "invalid_input", "Enter the account holder's name, account number and IFSC."
        )
    ratelimit.hit(conn, user.id, "teacher_payout", 10, 86400, "Too many changes today.")
    return {"payout": teachers.set_payout(conn, user.id, body.model_dump())}


@router.get("/review/teachers")
def review_queue(user: CurrentUser, conn: Conn, storage: Store) -> dict[str, Any]:
    return {"teachers": teachers.queue(conn, storage, user.id)}


@router.get("/review/me")
def am_reviewer(user: CurrentUser, conn: Conn) -> dict[str, bool]:
    return {"reviewer": teachers.is_reviewer(conn, user.id)}


@router.post("/review/teachers/{teacher_id}")
def review_teacher(
    teacher_id: UUID, body: ReviewIn, user: CurrentUser, conn: Conn
) -> dict[str, Any]:
    return teachers.review(conn, user.id, str(teacher_id), body.decision, body.note)
