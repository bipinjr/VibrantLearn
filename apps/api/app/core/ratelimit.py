"""Fixed-window limits in Postgres so they hold across serverless instances (SECURITY.md §11).

IP buckets are a coarse backstop for endpoints without a signed-in user (waitlist, sign-up).
User-id buckets are the real limit: an IP is easy to rotate and shared by whole college networks.
"""

import hashlib

import psycopg
from fastapi import Request

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


def hit(
    conn: psycopg.Connection[dict[str, object]],
    subject: str,
    bucket: str,
    limit: int,
    window_s: int,
    message: str,
) -> None:
    row = conn.execute(_HIT, {"s": subject, "b": bucket, "w": window_s}).fetchone()
    conn.commit()
    assert row is not None
    if int(str(row["count"])) > limit:
        raise ApiError(429, "rate_limited", message, headers={"Retry-After": str(row["retry"])})


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
