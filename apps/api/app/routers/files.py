from typing import Annotated, Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.core import ratelimit
from app.core.auth import CurrentUser
from app.core.db import get_conn
from app.core.storage import Storage, get_storage
from app.services import files, sessions

router = APIRouter()
Conn = Annotated[psycopg.Connection[dict[str, object]], Depends(get_conn)]
Store = Annotated[Storage, Depends(get_storage)]


class UploadIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=1, max_length=255
    )  # checked again (≤ 120, no paths) in the service
    mime: str = Field(default="", max_length=200)  # advisory only; the server picks the stored type
    size_bytes: int = Field(gt=0)


@router.post("/sessions/{session_id}/files/upload-url", status_code=201)
def upload_url(
    session_id: UUID, body: UploadIn, user: CurrentUser, conn: Conn, storage: Store
) -> dict[str, Any]:
    sessions.owned(conn, user.id, str(session_id))
    ratelimit.hit(conn, user.id, "upload_url", 40, 3600, "Too many uploads in an hour. Wait a bit.")
    return files.create_upload(conn, storage, user.id, str(session_id), body.name, body.size_bytes)
