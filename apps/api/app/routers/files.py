from typing import Annotated, Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field

from app.core import ratelimit
from app.core.auth import CurrentUser
from app.core.db import get_conn
from app.core.storage import Storage, get_storage
from app.services import files, process, sessions

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


class ProcessIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Images only: the text Tesseract.js read in the browser. Stored and searched, never run.
    ocr_text: str | None = Field(default=None, max_length=200_000)


@router.post("/files/{file_id}/process")
def process_file(
    file_id: UUID, user: CurrentUser, conn: Conn, storage: Store, body: ProcessIn | None = None
) -> dict[str, Any]:
    ratelimit.hit(conn, user.id, "file_process", 60, 3600, "Too many files at once. Wait a bit.")
    return process.process(conn, storage, user.id, str(file_id), body.ocr_text if body else None)


@router.get("/files/{file_id}/download-url")
def download_url(file_id: UUID, user: CurrentUser, conn: Conn, storage: Store) -> dict[str, Any]:
    return process.download_url(conn, storage, user.id, str(file_id))


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: UUID, user: CurrentUser, conn: Conn, storage: Store) -> Response:
    process.delete_file(conn, storage, user.id, str(file_id))
    return Response(status_code=204)
