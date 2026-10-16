from typing import Annotated, Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from app.core import ratelimit
from app.core.auth import CurrentUser
from app.core.db import get_conn, get_connect
from app.llm.client import Llm, get_llm
from app.services import messages, sessions

router = APIRouter()
Conn = Annotated[psycopg.Connection[dict[str, object]], Depends(get_conn)]


class MessageIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    text: str = Field(min_length=1, max_length=4000)
    language: Literal["en", "kn", "hi"] | None = None
    id: UUID | None = None  # client-made id, so the optimistic bubble and the row match


@router.post("/sessions/{session_id}/messages")
def send_message(
    session_id: UUID,
    body: MessageIn,
    user: CurrentUser,
    conn: Conn,
    connect: Annotated[messages.Connect, Depends(get_connect)],
    llm: Annotated[Llm, Depends(get_llm)],
) -> StreamingResponse:
    # Checks that can fail with a normal JSON error happen before the stream starts.
    sessions.owned(conn, user.id, str(session_id))
    ratelimit.hit(
        conn,
        user.id,
        "messages",
        30,
        600,
        "That's a lot of messages. Take a short break and try again.",
    )
    return StreamingResponse(
        messages.stream(
            connect,
            llm,
            user.id,
            str(session_id),
            body.text,
            body.language,
            str(body.id) if body.id else None,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
