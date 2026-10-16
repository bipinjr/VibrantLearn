"""Fixed-window limits in Postgres so they hold across serverless instances (SECURITY.md §11).

IP buckets are a coarse backstop for endpoints without a signed-in user (waitlist, sign-up).
User-id buckets are the real limit: an IP is easy to rotate and shared by whole college networks.
"""

import hashlib
from datetime import UTC, datetime, timedelta

import psycopg
from fastapi import Request

from app.core import audit
from app.core.config import get_settings
from app.core.errors import ApiError

_HIT = """
insert into internal.rate_limits (subject, bucket, window_start, count)
values (%(s)s, %(b)s, to_timestamp(floor(extract(epoch from now()) / %(w)s) * %(w)s), 1)
on conflict (subject, bucket, window_start)
  do update set count = internal.rate_limits.count + 1
returning count,
  ceil(extract(epoch from (window_start + make_interval(secs => %(w)s) - now())))::int as retry
"""


IST = timedelta(minutes=330)


def reset_phrase(retry_s: int, now: datetime | None = None) -> str:
    """'You can try again at 9:40 PM.' in the student's clock (Asia/Kolkata)."""
    at = (now or datetime.now(UTC)) + timedelta(seconds=retry_s) + IST
    return f"You can try again at {at.strftime('%I:%M %p').lstrip('0')}."


def check(
    conn: psycopg.Connection[dict[str, object]],
    subject: str,
    bucket: str,
    limit: int,
    window_s: int,
) -> int | None:
    """Counts one use. None if allowed, else seconds until the window resets. Never raises, so it
    is safe inside a streamed reply; every refusal is audit-logged."""
    row = conn.execute(_HIT, {"s": subject, "b": bucket, "w": window_s}).fetchone()
    assert row is not None
    over = int(str(row["count"])) > limit
    if over:
        # Subject is a user id or a salted IP hash, never a raw IP.
        user = subject if not subject.startswith("ip:") else None
        audit.record(
            conn, "rate_limited", user, ip_hash=None if user else subject, meta={"bucket": bucket}
        )
    conn.commit()
    return max(1, int(str(row["retry"]))) if over else None


def hit(
    conn: psycopg.Connection[dict[str, object]],
    subject: str,
    bucket: str,
    limit: int,
    window_s: int,
    message: str,
) -> None:
    """For ordinary endpoints: 429 with Retry-After and the reset time in plain words."""
    retry = check(conn, subject, bucket, limit, window_s)
    if retry is not None:
        raise ApiError(
            429,
            "rate_limited",
            f"{message} {reset_phrase(retry)}",
            headers={"Retry-After": str(retry)},
        )


def client_ip(request: Request) -> str:
    """The caller's IP. x-forwarded-for counts only when TRUSTED_PROXY is on, and then only its last
    hop (added by our proxy); earlier entries are whatever the client chose to send."""
    if get_settings().trusted_proxy:
        last = request.headers.get("x-forwarded-for", "").split(",")[-1].strip()
        if last:
            return last
    return request.client.host if request.client else "unknown"


def ip_hash(request: Request) -> str:
    # Only the salted hash is ever stored, never the raw IP.
    ip = client_ip(request)
    salt = get_settings().ip_hash_salt.get_secret_value()
    return "ip:" + hashlib.sha256(f"{salt}:{ip}".encode()).hexdigest()[:32]
