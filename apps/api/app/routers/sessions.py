from typing import Annotated
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, Response

from app.core import ratelimit
from app.core.auth import CurrentUser
from app.core.db import get_conn
from app.core.storage import Storage, get_storage
from app.services import sessions

router = APIRouter()
Conn = Annotated[psycopg.Connection[dict[str, object]], Depends(get_conn)]
Store = Annotated[Storage, Depends(get_storage)]


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: UUID, user: CurrentUser, conn: Conn, storage: Store) -> Response:
    ratelimit.hit(conn, user.id, "session_delete", 30, 3600, "Too many deletes. Wait a bit.")
    sessions.delete_session(conn, storage, user.id, str(session_id))
    return Response(status_code=204)
