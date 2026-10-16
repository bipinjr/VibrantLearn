from typing import Annotated, Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.core import ratelimit
from app.core.auth import CurrentUser
from app.core.db import get_conn
from app.services import study

router = APIRouter()
Conn = Annotated[psycopg.Connection[dict[str, object]], Depends(get_conn)]


class AnswerIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: int = Field(ge=0, le=20)
    choice: int = Field(ge=0, le=3)
    restart: bool = False  # "Try again": start a fresh attempt


@router.post("/quiz/{content_id}/answers")
def answer(content_id: UUID, body: AnswerIn, user: CurrentUser, conn: Conn) -> dict[str, Any]:
    """Grades one answer on the server. The first answer to each question is the one that counts."""
    ratelimit.hit(
        conn, user.id, "quiz_answers", 300, 3600, "That's a lot of answers. Take a short break."
    )
    return study.answer(conn, user.id, str(content_id), body.q, body.choice, body.restart)
