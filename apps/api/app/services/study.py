"""AI-written questions, past-paper-style questions, quizzes and flashcards (BUILD_PLAN D2), and
server-side quiz grading (D3).

Same shape as notes: write in English -> strict examiner corrects -> translate into the student's
language. Every output must parse into a schema below (one repair retry); if it still doesn't, or
the AI is down, the caller keeps the syllabus-built version, so the student never sees an error.

Quiz answer keys never reach the browser: the questions go to public.generated_content (owner-
readable), the key to internal.quiz_keys (never client-readable). The API grades each answer and
keeps the FIRST answer to every question, so a tampered client can't learn the key and then submit
a perfect score.
"""

import json
from typing import Annotated, Any, Literal

import psycopg
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.core.config import get_settings
from app.core.errors import ApiError
from app.llm import cache
from app.llm.client import Llm, LlmError, Message
from app.llm.prompts import LANG_NAME, STUDY_REVIEW, STUDY_TRANSLATE, STUDY_VERSION, STUDY_WRITE
from app.ml.scheduler import Topic
from app.services.content import plain

Conn = psycopg.Connection[dict[str, Any]]
Kind = Literal["important_questions", "pyq", "quiz", "flashcards"]
Text = Annotated[str, Field(min_length=2, max_length=600)]


def _no_markdown(v: str) -> str:
    return plain(v)


class Item(BaseModel):
    marks: Literal[2, 5, 10]
    q: Text
    _clean = field_validator("q")(_no_markdown)


class Questions(BaseModel):
    items: list[Item] = Field(min_length=3, max_length=8)


class QuizQ(BaseModel):
    q: Text
    options: list[Annotated[str, Field(min_length=1, max_length=200)]] = Field(
        min_length=4, max_length=4
    )
    answer: int = Field(ge=0, le=3)
    why: Text
    topic: Annotated[str, Field(max_length=200)]
    _clean = field_validator("q", "why")(_no_markdown)


class Quiz(BaseModel):
    questions: list[QuizQ] = Field(min_length=3, max_length=10)


class Card(BaseModel):
    front: Text
    back: Text
    _clean = field_validator("front", "back")(_no_markdown)


class Cards(BaseModel):
    cards: list[Card] = Field(min_length=3, max_length=12)


SCHEMA: dict[str, type[BaseModel]] = {
    "important_questions": Questions,
    "pyq": Questions,
    "quiz": Quiz,
    "flashcards": Cards,
}


def _parse(kind: str, text: str) -> dict[str, Any] | None:
    try:
        return SCHEMA[kind].model_validate(json.loads(text)).model_dump()
    except (ValueError, ValidationError):
        return None


def _step(
    conn: Conn, llm: Llm, user_id: str, kind: str, system: str, user: str, reasoning: Any
) -> dict[str, Any]:
    model = get_settings().groq_model_large
    for _ in range(2):  # one repair retry
        r = llm.chat(
            [Message("system", system), Message("user", user)],
            model=model, max_tokens=3000, temperature=0.2, json_mode=True,
            reasoning=reasoning, timeout_s=45,
        )  # fmt: skip
        cache.log_usage(conn, user_id, kind, "llm", r.tokens_in, r.tokens_out, r.latency_ms)
        if (v := _parse(kind, r.text)) is not None:
            return v
    raise LlmError(502, "llm_invalid", "The AI's answer didn't come out right.")


def generate(
    conn: Conn, llm: Llm, user_id: str, kind: Kind, subject: str, topics: list[Topic], lang: str
) -> tuple[dict[str, Any], str]:
    """(payload, served_from). Raises LlmError; the caller then keeps the syllabus version."""
    model = get_settings().groq_model_large
    topic_data = f"Subject: {subject}\n" + "\n".join(
        f"- {t.topic} (Unit {t.unit}: {t.unit_title}): {'; '.join(t.subtopics)}" for t in topics
    )
    key = cache.key(STUDY_VERSION, model, f"{kind}:{lang}", topic_data)
    if (hit := cache.get(conn, key)) is not None:
        cache.log_usage(conn, user_id, kind, "cache")
        return dict(hit), "cache"
    draft = _step(conn, llm, user_id, kind, STUDY_WRITE[kind], topic_data, "low")
    checked = _step(
        conn,
        llm,
        user_id,
        kind,
        STUDY_REVIEW,
        f"{topic_data}\n\nMaterial to check:\n{json.dumps(draft)}",
        "medium",
    )
    out = checked
    if lang != "en":
        out = _step(
            conn,
            llm,
            user_id,
            kind,
            STUDY_TRANSLATE.format(lang=LANG_NAME[lang]),
            json.dumps(checked),
            "low",
        )
        if kind == "quiz":  # the key and topic names must survive translation unchanged
            for a, b in zip(out["questions"], checked["questions"], strict=False):
                a["answer"], a["topic"] = b["answer"], b["topic"]
    cache.put(conn, key, kind, model, STUDY_VERSION, out)
    return out, "llm"


# ---- quizzes graded on the server (D3) --------------------------------------------------------


def store_quiz(
    conn: Conn,
    user_id: str,
    session_id: str,
    subject: str,
    lang: str,
    questions: list[dict[str, Any]],
) -> dict[str, Any]:
    """Saves the quiz, returns the browser's version: questions and options, no answers."""
    row = conn.execute(
        "insert into public.generated_content "
        "(user_id, session_id, topic, kind, language, payload, cache_key) "
        "values (%s, %s, %s, 'quiz', %s, %s, %s) returning id",
        (
            user_id, session_id, subject[:200], lang,
            Jsonb({"questions": [{k: q[k] for k in ("q", "options", "topic")} for q in questions]}),
            f"quiz|{subject}",
        ),
    ).fetchone()  # fmt: skip
    assert row is not None
    content_id = str(row["id"])
    conn.execute(
        "insert into internal.quiz_keys (content_id, answers, why, topics) values (%s, %s, %s, %s)",
        (
            content_id,
            [q["answer"] for q in questions],
            [q["why"] for q in questions],
            [q["topic"] for q in questions],
        ),
    )
    return {
        "contentId": content_id,
        "questions": [{k: q[k] for k in ("q", "options", "topic")} for q in questions],
    }


def answer(
    conn: Conn, user_id: str, content_id: str, q: int, choice: int, restart: bool
) -> dict[str, Any]:
    key = conn.execute(
        "select k.answers, k.why, k.topics from internal.quiz_keys k "
        "join public.generated_content g on g.id = k.content_id "
        "where k.content_id = %s and g.user_id = %s",
        (content_id, user_id),
    ).fetchone()
    if key is None:
        raise ApiError(404, "not_found", "That quiz doesn't exist.")
    answers: list[int] = list(key["answers"])
    total = len(answers)
    if not 0 <= q < total or not 0 <= choice <= 3:
        raise ApiError(422, "invalid_input", "That question or option doesn't exist.")
    att = conn.execute(
        "select id, answers from public.quiz_attempts where content_id = %s and user_id = %s "
        "order by created_at desc limit 1",
        (content_id, user_id),
    ).fetchone()
    recorded: dict[str, int] = (
        dict(att["answers"]) if att and isinstance(att["answers"], dict) else {}
    )
    if att is None or restart or len(recorded) >= total:
        recorded = {}
        att = conn.execute(
            "insert into public.quiz_attempts (user_id, content_id, answers, score, total) "
            "values (%s, %s, '{}', 0, %s) returning id, answers",
            (user_id, content_id, total),
        ).fetchone()
        assert att is not None
    # The first answer to a question is the one that counts; asking again can't change it.
    first = recorded.setdefault(str(q), choice)
    score = sum(1 for k, v in recorded.items() if answers[int(k)] == v)
    conn.execute(
        "update public.quiz_attempts set answers = %s, score = %s where id = %s and user_id = %s",
        (Jsonb(recorded), score, att["id"], user_id),
    )
    conn.commit()
    done = len(recorded) == total
    wrong = (
        sorted({key["topics"][int(k)] for k, v in recorded.items() if answers[int(k)] != v})
        if done
        else []
    )
    return {
        "correct": first == answers[q],
        "answer": answers[q],
        "why": key["why"][q],
        "counted": first,
        "score": score,
        "answered": len(recorded),
        "total": total,
        "done": done,
        "wrongTopics": wrong,
    }
