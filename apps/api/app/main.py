import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

from app.core import errors
from app.core.config import get_settings
from app.routers import health, me, waitlist


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        out = {"level": record.levelname, "msg": record.getMessage(), "logger": record.name}
        for k in ("request_id", "path", "status", "ms"):
            if hasattr(record, k):
                out[k] = getattr(record, k)
        return json.dumps(out)


_handler = logging.StreamHandler()
_handler.setFormatter(_JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler], force=True)
log = logging.getLogger("api")

settings = get_settings()
app = FastAPI(
    title="VibrantLearn API",
    docs_url=None if settings.is_prod else "/api/v1/docs",
    openapi_url=None if settings.is_prod else "/api/v1/openapi.json",
    redoc_url=None,
)
errors.install(app)


@app.middleware("http")
async def request_id(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    rid = request.headers.get("x-request-id", "")
    rid = rid if 8 <= len(rid) <= 64 and rid.replace("-", "").isalnum() else uuid.uuid4().hex
    request.state.request_id = rid
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    ms = round((time.perf_counter() - start) * 1000)
    # Path only, never query strings (they may carry usernames/emails).
    log.info(
        "request",
        extra={
            "request_id": rid,
            "path": request.url.path,
            "status": response.status_code,
            "ms": ms,
        },
    )
    return response


for r in (health.router, me.router, waitlist.router):
    app.include_router(r, prefix="/api/v1")
