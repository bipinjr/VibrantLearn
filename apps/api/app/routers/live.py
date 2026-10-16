"""TEACHER.md T2-T10 endpoints and student rewards. Thin: rules live in services/."""

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, Query, Response
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.core import ratelimit
from app.core.auth import CurrentUser
from app.core.db import get_conn
from app.core.errors import ApiError
from app.services import class_chat, classes, demand, health, rewards

router = APIRouter()
Conn = Annotated[psycopg.Connection[dict[str, object]], Depends(get_conn)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RescheduleIn(Strict):
    starts_at: AwareDatetime


class RepeatIn(Strict):
    days: int = Field(default=7, ge=1, le=28)


class ReportIn(Strict):
    reason: str = Field(min_length=3, max_length=300)
    user_id: UUID | None = None
    message_id: int | None = Field(default=None, ge=1)


class AppealIn(Strict):
    warning_id: int = Field(ge=1)
    body: str = Field(min_length=10, max_length=1000)


class NotifyIn(Strict):
    class_reminders: bool
    demand_alerts: bool


class DecideIn(Strict):
    decision: bool
    outcome: str = Field(min_length=3, max_length=300)


class OptIn(Strict):
    on: bool


def _verified_or_pending(
    conn: psycopg.Connection[dict[str, object]], user_id: str
) -> dict[str, Any]:
    t = classes.teacher(conn, user_id)
    if not t or t["status"] not in ("verified", "pending"):
        raise ApiError(403, "forbidden", "Set up your teacher profile to see this.")
    return t


# ---- T2 demand, T3 topics ------------------------------------------------------------------------


@router.get("/teachers/demand")
def tonight_demand(user: CurrentUser, conn: Conn) -> dict[str, Any]:
    t = _verified_or_pending(conn, user.id)  # unverified teachers may browse demand (T1)
    return {
        "demand": demand.board(conn, user.id, list(t["subjects"])),
        "bucket_min": classes.AGGREGATE_MIN,
    }


@router.get("/teachers/topics")
def subject_topics(
    user: CurrentUser, conn: Conn, subject: Annotated[str, Query(min_length=2, max_length=120)]
) -> dict[str, Any]:
    return {"topics": classes.topics_for(conn, subject)}


@router.get("/teachers/{teacher_id}/public")
def teacher_public(teacher_id: UUID, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    return {"teacher": classes.public_profile(conn, str(teacher_id))}


# ---- T4 runway, T5 during, T6 after --------------------------------------------------------------


@router.post("/classes/{class_id}/reschedule", status_code=204)
def reschedule(class_id: UUID, body: RescheduleIn, user: CurrentUser, conn: Conn) -> Response:
    classes.reschedule(conn, user.id, str(class_id), body.starts_at)
    return Response(status_code=204)


@router.post("/classes/{class_id}/repeat", status_code=201)
def run_again(class_id: UUID, body: RepeatIn, user: CurrentUser, conn: Conn) -> dict[str, str]:
    ratelimit.hit(conn, user.id, "class_create", 10, 86400, "That's a lot of classes for one day.")
    return {"id": classes.repeat(conn, user.id, str(class_id), body.days)}


@router.get("/classes/{class_id}/people")
def class_people(class_id: UUID, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    return {"people": classes.people(conn, user.id, str(class_id))}


@router.get("/classes/{class_id}/summary")
def class_summary(class_id: UUID, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    return classes.summary(conn, user.id, str(class_id))


@router.post("/classes/{class_id}/chat/{message_id}/answered", status_code=204)
def question_answered(class_id: UUID, message_id: int, user: CurrentUser, conn: Conn) -> Response:
    class_chat.answered(conn, user.id, str(class_id), message_id)
    return Response(status_code=204)


@router.post("/classes/{class_id}/report", status_code=201)
def report(class_id: UUID, body: ReportIn, user: CurrentUser, conn: Conn) -> dict[str, str]:
    ratelimit.hit(conn, user.id, "class_report", 10, 3600, "Too many reports. Wait a bit.")
    return health.report(
        conn,
        user.id,
        str(class_id),
        body.reason,
        str(body.user_id) if body.user_id else None,
        body.message_id,
    )


# ---- T9 account health, T10 settings ---------------------------------------------------------------


@router.get("/teachers/health")
def account_health(user: CurrentUser, conn: Conn) -> dict[str, Any]:
    return {"warnings": health.warnings(conn, user.id), "reports": health.my_reports(conn, user.id)}


@router.post("/teachers/appeals", status_code=201)
def appeal(body: AppealIn, user: CurrentUser, conn: Conn) -> dict[str, str]:
    ratelimit.hit(conn, user.id, "appeal", 5, 86400, "Too many appeals today.")
    return health.appeal(conn, user.id, body.warning_id, body.body)


@router.put("/teachers/notify")
def notify(body: NotifyIn, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    if not classes.teacher(conn, user.id):
        raise ApiError(409, "no_profile", "Save your teacher profile first.")
    conn.execute(
        "update public.teachers set notify = jsonb_build_object('class_reminders', %s::boolean, 'demand_alerts', %s::boolean) "
        "where user_id = %s",
        (body.class_reminders, body.demand_alerts, user.id),
    )
    conn.commit()
    return {"notify": body.model_dump()}


# ---- reviewer: appeals and reports ---------------------------------------------------------------


@router.get("/review/cases")
def review_cases(user: CurrentUser, conn: Conn) -> dict[str, Any]:
    return health.open_cases(conn, user.id)


@router.post("/review/appeals/{appeal_id}")
def decide_appeal(appeal_id: int, body: DecideIn, user: CurrentUser, conn: Conn) -> dict[str, str]:
    return health.decide_appeal(conn, user.id, appeal_id, body.decision, body.outcome)


@router.post("/review/reports/{flag_id}")
def decide_report(flag_id: int, body: DecideIn, user: CurrentUser, conn: Conn) -> dict[str, str]:
    return health.decide_report(conn, user.id, flag_id, body.decision, body.outcome)


# ---- rewards -------------------------------------------------------------------------------------


@router.get("/me/rewards")
def my_rewards(user: CurrentUser, conn: Conn) -> dict[str, Any]:
    return rewards.mine(conn, user.id, datetime.now(UTC))


@router.get("/me/rewards/leaderboard")
def leaderboard(user: CurrentUser, conn: Conn) -> dict[str, Any]:
    return rewards.leaderboard(conn, user.id)


@router.put("/me/rewards/optin")
def optin(body: OptIn, user: CurrentUser, conn: Conn) -> dict[str, bool]:
    rewards.set_optin(conn, user.id, body.on)
    return {"on_leaderboard": body.on}
