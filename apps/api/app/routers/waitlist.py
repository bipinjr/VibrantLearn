import re
from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core import ratelimit
from app.core.db import get_conn

router = APIRouter()
Conn = Annotated[psycopg.Connection[dict[str, object]], Depends(get_conn)]
_EMAIL = re.compile(r"^[^@\s<>]{1,64}@[^@\s<>]+\.[A-Za-z]{2,}$")


class WaitlistIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    email: str = Field(max_length=254)
    source: str | None = Field(default=None, max_length=60)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        if not _EMAIL.fullmatch(v):
            raise ValueError("Enter an email like name@example.com.")
        return v.lower()


@router.post("/waitlist", status_code=202)
def join_waitlist(body: WaitlistIn, request: Request, conn: Conn) -> dict[str, bool]:
    ratelimit.hit(
        conn,
        ratelimit.ip_hash(request),
        "waitlist",
        5,
        3600,
        "You've already joined a few times this hour. Try again later.",
    )
    # Same answer whether or not the email was already there: safe on double submit, no enumeration.
    conn.execute(
        "insert into public.waitlist (email, source) values (%s, %s) "
        "on conflict (email) do nothing",
        (body.email, body.source),
    )
    conn.commit()
    return {"ok": True}
