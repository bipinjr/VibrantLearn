from typing import Annotated, Any, Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, Query, Response
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.core import ratelimit
from app.core.auth import CurrentUser
from app.core.db import get_conn
from app.llm.client import Llm, get_llm
from app.services import class_chat, classes, teachers

router = APIRouter()
Conn = Annotated[psycopg.Connection[dict[str, object]], Depends(get_conn)]


class ApplyIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    display_name: str = Field(min_length=2, max_length=60)
    bio: str = Field(default="", max_length=600)
    subjects: list[Annotated[str, Field(min_length=2, max_length=120)]] = Field(
        min_length=1, max_length=8
    )
    qualification: str = Field(default="", max_length=120)
    experience_years: int = Field(default=0, ge=0, le=60)
    languages: list[Literal["en", "kn", "hi"]] = Field(default=["en"], min_length=1, max_length=3)
    preferred_days: list[Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]] = Field(
        default=[], max_length=7
    )
    preferred_slots: list[Literal["5-6pm", "6-7pm", "7-8pm", "8-9pm", "9-10pm"]] = Field(
        default=[], max_length=5
    )
    levels: list[Literal["beginner", "exam_prep", "all"]] = Field(
        default=["all"], min_length=1, max_length=3
    )
    organisation: str = Field(default="", max_length=120)
    consent: Literal[True]


class ClassIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    subject: str = Field(min_length=2, max_length=120)
    topic: str = Field(min_length=2, max_length=160)
    level: Literal["beginner", "exam_prep", "all"] = "all"
    starts_at: AwareDatetime
    duration_min: int = Field(ge=30, le=120)


@router.get("/teachers/me")
def my_teacher_profile(user: CurrentUser, conn: Conn) -> dict[str, Any]:
    t = classes.teacher(conn, user.id)
    if not t:
        return {"teacher": None, "earnings": None, "stats": None, "payout": None}
    return {
        "teacher": t,
        "earnings": classes.earnings(conn, user.id),
        "stats": classes.stats(conn, user.id),
        "payout": teachers.payout_masked(conn, user.id),
        "review_promise": teachers.REVIEW_PROMISE,
        "rules": classes.rules(),
    }


@router.post("/teachers/apply")
def apply(body: ApplyIn, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    ratelimit.hit(conn, user.id, "teacher_apply", 5, 86400, "Too many applications today.")
    teachers.check_subjects(conn, body.subjects)
    return {"teacher": classes.apply(conn, user.id, body.model_dump(exclude={"consent"}))}


@router.post("/teachers/withdraw")
def withdraw(user: CurrentUser, conn: Conn) -> dict[str, Any]:
    ratelimit.hit(
        conn, user.id, "teacher_withdraw", 5, 86400, "Too many withdrawal requests today."
    )
    return {"earnings": classes.withdraw(conn, user.id)}


class RatingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stars: int = Field(ge=1, le=5)


@router.put("/classes/{class_id}/rating")
def rate_class(class_id: UUID, body: RatingIn, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    ratelimit.hit(conn, user.id, "class_rating", 30, 3600, "Too many changes. Wait a bit.")
    return classes.rate(conn, user.id, str(class_id), body.stars)


@router.get("/classes")
def list_classes(user: CurrentUser, conn: Conn) -> dict[str, Any]:
    return {"classes": classes.listing(conn, user.id)}


@router.post("/classes", status_code=201)
def create_class(body: ClassIn, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    ratelimit.hit(conn, user.id, "class_create", 10, 86400, "That's a lot of classes for one day.")
    return {
        "id": classes.create(
            conn, user.id, body.subject, body.topic, body.level, body.starts_at, body.duration_min
        )
    }


@router.post("/classes/{class_id}/cancel", status_code=204)
def cancel_class(class_id: UUID, user: CurrentUser, conn: Conn) -> Response:
    classes.cancel(conn, user.id, str(class_id))
    return Response(status_code=204)


@router.put("/classes/{class_id}/interest")
def mark_interested(class_id: UUID, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    ratelimit.hit(conn, user.id, "class_interest", 60, 3600, "Too many changes. Wait a bit.")
    return classes.interest(conn, user.id, str(class_id), True)


@router.delete("/classes/{class_id}/interest")
def unmark_interested(class_id: UUID, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    ratelimit.hit(conn, user.id, "class_interest", 60, 3600, "Too many changes. Wait a bit.")
    return classes.interest(conn, user.id, str(class_id), False)


@router.post("/classes/{class_id}/join")
def join_class(class_id: UUID, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    ratelimit.hit(conn, user.id, "class_join", 30, 3600, "Too many attempts. Wait a bit.")
    return classes.join(conn, user.id, str(class_id), classes.display_name(conn, user.id))


class ChatIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    body: str = Field(min_length=1, max_length=500)


@router.get("/classes/{class_id}/chat")
def read_chat(
    class_id: UUID, user: CurrentUser, conn: Conn, after: Annotated[int, Query(ge=0)] = 0
) -> dict[str, Any]:
    return class_chat.read(conn, user.id, str(class_id), after)


@router.post("/classes/{class_id}/chat")
def send_chat(
    class_id: UUID,
    body: ChatIn,
    user: CurrentUser,
    conn: Conn,
    llm: Annotated[Llm, Depends(get_llm)],
) -> dict[str, Any]:
    ratelimit.hit(
        conn, user.id, "class_chat", 20, 60, "You're sending messages too fast. Wait a moment."
    )
    return class_chat.send(conn, llm, user.id, str(class_id), body.body)
