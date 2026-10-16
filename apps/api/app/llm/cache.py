"""internal.llm_cache and internal.usage_events (BUILD_PLAN D1).

One cached answer per (prompt version, model, kind, source), shared by every student and every
server instance. Anything that changes the output must be in the key, or students get someone
else's answer.
"""

import hashlib
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

Conn = psycopg.Connection[dict[str, Any]]


def key(prompt_version: str, model: str, kind: str, source: str) -> str:
    digest = hashlib.sha256(source.encode()).hexdigest()
    return f"{prompt_version}|{model}|{kind}|{digest}"


def get(conn: Conn, cache_key: str) -> Any | None:
    row = conn.execute(
        "update internal.llm_cache set hits = hits + 1 "
        "where cache_key = %s and expires_at > now() returning response",
        (cache_key,),
    ).fetchone()
    conn.commit()
    return row["response"] if row else None


def put(conn: Conn, cache_key: str, kind: str, model: str, version: str, response: Any) -> None:
    conn.execute(
        "insert into internal.llm_cache (cache_key, kind, model, prompt_version, response) "
        "values (%s, %s, %s, %s, %s) on conflict (cache_key) do update "
        "set response = excluded.response, expires_at = now() + interval '30 days'",
        (cache_key, kind, model, version, Jsonb(response)),
    )
    conn.commit()


def log_usage(
    conn: Conn,
    user_id: str | None,
    kind: str,
    served_from: str,
    tokens_in: int = 0,
    tokens_out: int = 0,
    latency_ms: int = 0,
) -> None:
    conn.execute(
        "insert into internal.usage_events "
        "(user_id, kind, served_from, tokens_in, tokens_out, latency_ms) "
        "values (%s, %s, %s, %s, %s, %s)",
        (user_id, kind, served_from, tokens_in, tokens_out, latency_ms),
    )
    conn.commit()
