"""Class chat with the moderation bot (v0.5).

Every message goes through the bot before anyone else sees it:
1. local filter (app/ml/moderate.py) hides clear abuse, sexual content, hate, threats, contact details;
2. "maybe rude" messages go to the LLM; if it can't answer, the message is allowed (fail open,
   so a Groq outage doesn't silence a class).
A hidden message stays visible to its author with the reason, and counts as a warning in this class.
The bot posts a public notice (by username, never anything else). At 3 warnings the author is
removed from the class (chat closed, /join refused) and gets one account-level warning.
Hidden text is kept as evidence for review; it is never shown to anyone but its author.
"""

import json
from datetime import UTC, datetime
from typing import Any

from app.core.config import get_settings
from app.core.errors import ApiError
from app.llm import cache, prompts
from app.llm.client import Llm, LlmError, Message
from app.ml import moderate
from app.services import classes
from app.services.classes import STRIKES_TO_REMOVE, Conn

BOT = "VibrantLearn bot"
LABEL = {
    "abuse": "abusive language",
    "sexual": "sexual content",
    "hate": "hate speech",
    "threat": "a threat",
    "contact": "contact details or links",
}
OPEN_PHASES = ("teacher_early", "grace", "open")


def notice(name: str, category: str, strikes: int) -> str:
    if strikes >= STRIKES_TO_REMOVE:
        return f"Removed {name} from this class after {STRIKES_TO_REMOVE} warnings."
    return (
        f"Hid a message from {name}: {LABEL[category]}. Warning {strikes} of {STRIKES_TO_REMOVE}."
    )


def _ask_llm(conn: Conn, llm: Llm, user_id: str, body: str) -> moderate.Verdict:
    model = get_settings().groq_model_small
    k = cache.key(prompts.MODERATE_VERSION, model, "moderation", body.lower())
    hit = cache.get(conn, k)
    if hit is None:
        try:
            r = llm.chat(
                [Message("system", prompts.MODERATE), Message("user", body)],
                model=model, max_tokens=300, temperature=0, json_mode=True, timeout_s=6.0,
            )  # fmt: skip
            hit = json.loads(r.text)
            cache.put(conn, k, "moderation", model, prompts.MODERATE_VERSION, hit)
            cache.log_usage(
                conn, user_id, "moderation", "llm", r.tokens_in, r.tokens_out, r.latency_ms
            )
        except (LlmError, ValueError):
            return moderate.Verdict(False)  # fail open
    category = hit.get("category") if isinstance(hit, dict) else None
    if isinstance(hit, dict) and hit.get("hide") is True and category in LABEL:
        return moderate.Verdict(True, str(category))
    return moderate.Verdict(False)


def _member(conn: Conn, user_id: str, class_id: str) -> tuple[classes.Klass, str]:
    c = classes._get(conn, class_id)
    r = conn.execute(
        "select role from public.class_attendance where class_id = %s and user_id = %s",
        (class_id, user_id),
    ).fetchone()
    if r is None:
        raise ApiError(403, "forbidden", "Join the class to use its chat.")
    return c, str(r["role"])


def _strikes(conn: Conn, user_id: str, class_id: str) -> int:
    n = conn.execute(
        "select count(*) as n from internal.class_messages "
        "where class_id = %s and user_id = %s and hidden_reason is not null",
        (class_id, user_id),
    ).fetchone()
    return int(n["n"]) if n else 0


def _out(r: dict[str, Any], user_id: str) -> dict[str, Any]:
    reason = r["hidden_reason"]
    return {
        "id": int(r["id"]),
        "author": r["author"],
        "body": r["body"],
        "at": r["created_at"].isoformat(),
        "bot": r["user_id"] is None,
        "mine": str(r["user_id"]) == user_id,
        "hidden": f"Only you can see this. The bot hid it: {LABEL[reason]}." if reason else None,
        "question": bool(r.get("is_question")),
        "answered": r.get("answered_at") is not None,
    }


def read(conn: Conn, user_id: str, class_id: str, after: int) -> dict[str, Any]:
    _member(conn, user_id, class_id)
    rows = conn.execute(
        "select id, user_id, author, body, hidden_reason, created_at, is_question, answered_at from internal.class_messages "
        "where class_id = %s and id > %s and (hidden_reason is null or user_id = %s) "
        "order by id limit 200",
        (class_id, after, user_id),
    ).fetchall()
    strikes = _strikes(conn, user_id, class_id)
    return {
        "messages": [_out(r, user_id) for r in rows],
        "strikes": strikes,
        "strikes_to_remove": STRIKES_TO_REMOVE,
        "removed": strikes >= STRIKES_TO_REMOVE,
    }


def send(
    conn: Conn,
    llm: Llm,
    user_id: str,
    class_id: str,
    body: str,
    now: datetime | None = None,
    is_question: bool = False,
) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    c, role = _member(conn, user_id, class_id)
    if classes.phase(c, now) not in OPEN_PHASES:
        raise ApiError(409, "closed", "The class chat is closed.")
    strikes = _strikes(conn, user_id, class_id)
    if strikes >= STRIKES_TO_REMOVE:
        raise ApiError(
            403,
            "removed",
            "The moderation bot removed you from this class for breaking the chat rules.",
        )
    v = moderate.check(body, allow_links=role == "teacher")
    if v.soft:
        v = _ask_llm(conn, llm, user_id, body)
    name = classes.display_name(conn, user_id)
    row = conn.execute(
        "insert into internal.class_messages (class_id, user_id, author, body, hidden_reason, is_question) "
        "values (%s, %s, %s, %s, %s, %s) returning id, user_id, author, body, hidden_reason, created_at, is_question, answered_at",
        (
            class_id,
            user_id,
            name,
            body,
            v.category if v.hide else None,
            is_question and role == "student",
        ),
    ).fetchone()
    assert row is not None
    if v.hide and v.category:
        strikes += 1
        conn.execute(
            "insert into internal.class_messages (class_id, user_id, author, body) values (%s, null, %s, %s)",
            (class_id, BOT, notice(name, v.category, strikes)),
        )
        if strikes >= STRIKES_TO_REMOVE:
            classes.warn(conn, user_id, class_id, "Removed from a class by the moderation bot.")
    conn.commit()
    return {
        "message": _out(row, user_id),
        "strikes": strikes,
        "strikes_to_remove": STRIKES_TO_REMOVE,
        "removed": strikes >= STRIKES_TO_REMOVE,
    }


def answered(conn: Conn, user_id: str, class_id: str, message_id: int) -> None:
    """TEACHER.md T5: the teacher ticks a question off the queue."""
    _, role = _member(conn, user_id, class_id)
    if role != "teacher":
        raise ApiError(403, "forbidden", "Only the teacher can mark questions answered.")
    conn.execute(
        "update internal.class_messages set answered_at = coalesce(answered_at, now()) "
        "where id = %s and class_id = %s and is_question",
        (message_id, class_id),
    )
    conn.commit()
