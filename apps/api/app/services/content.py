"""AI-written content, always validated, cached and logged (SECURITY.md §9, BUILD_PLAN D1).

Notes are written in three steps for accuracy: write the English note, have a strict examiner
check and correct it, then translate that exact text. Only syllabus data reaches the notes prompt;
a student's own words reach the model only as the user turn of an open question.
"""

import json
import re
from typing import Any

import psycopg

from app.core.config import get_settings
from app.llm import cache
from app.llm.client import Llm, LlmError, Message, Reasoning
from app.llm.prompts import (
    CHAT_SYSTEM,
    CHAT_VERSION,
    LANG_NAME,
    NOTES_REVIEW,
    NOTES_VERSION,
    NOTES_WRITE,
    TRANSLATE,
)
from app.ml.scheduler import Topic

Conn = psycopg.Connection[dict[str, Any]]


def plain(s: str) -> str:
    """Models still slip into markdown now and then; students see plain text."""
    s = re.sub(r"\*\*|__|`+", "", s)
    s = re.sub(r"^#{1,6}\s+", "", s, flags=re.M)
    return re.sub(r"^\s*[-*]\s+", "• ", s, flags=re.M).strip()


def _note_ok(s: str) -> str | None:
    s = plain(s)
    return s if 80 <= len(s) <= 3000 else None


def _ask(
    conn: Conn,
    llm: Llm,
    user_id: str,
    kind: str,
    messages: list[Message],
    parse: Any,
    *,
    model: str,
    max_tokens: int,
    json_mode: bool = False,
    reasoning: Reasoning = "low",
    timeout_s: float = 45.0,
) -> Any:
    """One call, one repair retry if the output doesn't validate, then LlmError(llm_invalid)."""
    for _ in range(2):
        r = llm.chat(
            messages,
            model=model,
            max_tokens=max_tokens,
            temperature=0.1,
            json_mode=json_mode,
            reasoning=reasoning,
            timeout_s=timeout_s,
        )
        cache.log_usage(conn, user_id, kind, "llm", r.tokens_in, r.tokens_out, r.latency_ms)
        value = parse(r.text)
        if value is not None:
            return value
    raise LlmError(502, "llm_invalid", "The AI's answer didn't come out right.")


def _translations(text: str) -> dict[str, str] | None:
    try:
        v = json.loads(text)
    except ValueError:
        return None
    if not isinstance(v, dict):
        return None
    kn, hi = _note_ok(str(v.get("kn", ""))), _note_ok(str(v.get("hi", "")))
    return {"kn": kn, "hi": hi} if kn and hi else None


def notes(conn: Conn, llm: Llm, user_id: str, t: Topic) -> tuple[dict[str, str], str]:
    """({"en","kn","hi"}, served_from). Raises LlmError; the caller falls back to the template."""
    model = get_settings().groq_model_large
    source = f"{t.subject}|{t.unit}|{t.unit_title}|{t.topic}|{'; '.join(t.subtopics)}"
    key = cache.key(NOTES_VERSION, model, "notes", source)
    if (hit := cache.get(conn, key)) is not None:
        cache.log_usage(conn, user_id, "notes", "cache")
        return dict(hit), "cache"
    topic_data = (
        f"Subject: {t.subject}\nUnit {t.unit}: {t.unit_title}\nTopic: {t.topic}\n"
        f"Cover these subtopics: {'; '.join(t.subtopics)}"
    )
    en = _ask(
        conn, llm, user_id, "notes",
        [Message("system", NOTES_WRITE), Message("user", topic_data)],
        _note_ok, model=model, max_tokens=2000,
    )  # fmt: skip
    checked = _ask(
        conn, llm, user_id, "notes",
        [Message("system", NOTES_REVIEW), Message("user", f"{topic_data}\n\nNote to check:\n{en}")],
        _note_ok, model=model, max_tokens=3000, reasoning="medium", timeout_s=60,
    )  # fmt: skip
    tr = _ask(
        conn, llm, user_id, "notes",
        [Message("system", TRANSLATE), Message("user", checked)],
        _translations, model=model, max_tokens=4000, json_mode=True,
    )  # fmt: skip
    out = {"en": checked, **tr}
    cache.put(conn, key, "notes", model, NOTES_VERSION, out)
    return out, "llm"


def answer_open(
    conn: Conn, llm: Llm, user_id: str, text: str, lang: str, history: list[Message]
) -> str:
    """An open question in the student's language. Raises LlmError."""
    model = get_settings().groq_model_small
    system = CHAT_SYSTEM.format(lang=LANG_NAME.get(lang, "English"))
    r = llm.chat(
        [Message("system", system), *history[-6:], Message("user", text[:2000])],
        model=model,
        max_tokens=600,
        temperature=0.4,
    )
    cache.log_usage(
        conn, user_id, f"chat:{CHAT_VERSION}", "llm", r.tokens_in, r.tokens_out, r.latency_ms
    )
    return plain(r.text)[:4000]
