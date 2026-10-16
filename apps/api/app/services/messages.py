"""POST /sessions/{id}/messages: the main pipeline (ARCHITECTURE.md §2, BUILD_PLAN B2/B3).

parse -> intent -> one follow-up if something is missing -> local answer (scheduler, syllabus
content) -> cache -> LLM only if needed -> persist -> stream.

Events, in order: `status` (what we're doing), `session` (title/subject/deadline changed),
`plan` (a new plan, whole), one `block` per reply block, then `done`. The assistant message is
written only after the last block, in one insert, so a dropped connection never leaves a
half-written row.
"""

import json
import logging
import uuid
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager
from datetime import UTC, datetime
from typing import Any, cast

import psycopg
from psycopg.types.json import Jsonb

from app.llm import cache
from app.llm.client import Llm, LlmError, Message
from app.ml import intent as intent_model
from app.ml.parse import Lang, parse_request
from app.services import content, retrieval, study, syllabus
from app.services.reply import Ctx, Reply, respond, topic_note

Conn = psycopg.Connection[dict[str, Any]]
log = logging.getLogger("api")
Connect = Callable[[], AbstractContextManager[Conn]]


def sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _label(r: Reply) -> str:
    if r.open:
        return "Thinking it through"
    if r.plan:
        return "Building your plan"
    if r.ai_notes:
        return "Writing your notes"
    return "Reading your request"


def _context(
    conn: Conn, user_id: str, session_id: str, language: Lang | None, now: datetime
) -> Ctx:
    sess = conn.execute(
        "select subject from public.study_sessions where id = %s and user_id = %s",
        (session_id, user_id),
    ).fetchone()
    prof = conn.execute("select language from public.profiles where id = %s", (user_id,)).fetchone()
    last = conn.execute(
        "select blocks from public.messages where session_id = %s and user_id = %s "
        "and role = 'assistant' order by created_at desc limit 1",
        (session_id, user_id),
    ).fetchone()
    pending = next(
        (
            b["pending"]
            for b in (last["blocks"] if last else [])
            if isinstance(b, dict) and b.get("pending")
        ),
        None,
    )
    files = conn.execute(
        "select id, display_name as name, status from public.files "
        "where session_id = %s and user_id = %s",
        (session_id, user_id),
    ).fetchall()
    topics = syllabus.load(conn)
    return Ctx(
        now=now,
        language=language or (prof["language"] if prof else "en"),
        subjects=sorted(topics),
        topics_for=lambda s: topics.get(s, []),
        session_subject=(sess["subject"] if sess else None) or None,
        pending=pending,
        files=[dict(f) for f in files],
    )


def _history(conn: Conn, user_id: str, session_id: str) -> list[Message]:
    rows = conn.execute(
        "select role, content, blocks from public.messages where session_id = %s and user_id = %s "
        "order by created_at desc limit 7",
        (session_id, user_id),
    ).fetchall()
    out: list[Message] = []
    for r in reversed(rows[1:]):  # rows[0] is the message being answered
        text = r["content"] or " ".join(
            b.get("text", "")
            for b in r["blocks"]
            if isinstance(b, dict) and isinstance(b.get("text"), str)
        )
        if text:
            out.append(Message("user" if r["role"] == "user" else "assistant", text[:2000]))
    return out


def _study_block(b: dict[str, Any], kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    if kind in ("important_questions", "pyq") and b["type"] == "questions":
        return {**b, "items": payload["items"]}
    if kind == "quiz" and b["type"] == "quiz":
        return {**b, "questions": payload["questions"]}
    if kind == "flashcards" and b["type"] == "flashcards":
        return {**b, "cards": payload["cards"]}
    return b


def _from_files(
    conn: Conn, llm: Llm, user_id: str, session_id: str, text: str, reply: Reply, ctx: Ctx
) -> tuple[list[dict[str, Any]], str]:
    """Answer from the student's own notes, with sources; say so when the notes don't have it."""
    ready = [dict(f, id=str(f["id"])) for f in ctx.files if f.get("status") == "ready"]
    named = retrieval.mentioned_files(text, ready)
    summary = reply.intent == "summarize_file"
    if summary:
        target = (named or ready)[:1]
        chunks = retrieval.first_chunks(conn, user_id, target[0]["id"]) if target else []
    else:
        chunks = retrieval.search(conn, user_id, session_id, text, [f["id"] for f in named] or None)
    if not chunks:
        msg = "I couldn't find that in your notes. Try other words, or name the file with @."
        return [{"type": "text", "text": msg}], "ml"
    try:
        answer, served = retrieval.answer(
            conn, llm, user_id, chunks, text, reply.lang or ctx.language, summary
        )
    except LlmError as e:
        return [{"type": "followup", "text": e.message, "chips": ["Try again"]}], "ml"
    return [{"type": "text", "text": answer, "sources": retrieval.sources(chunks)}], served


def _save_plan(conn: Conn, user_id: str, session_id: str, plan: dict[str, Any], lang: Lang) -> str:
    plan_id = str(uuid.uuid4())
    conn.execute(
        "delete from public.study_plans where session_id = %s and user_id = %s",
        (session_id, user_id),
    )
    conn.execute(
        "insert into public.study_plans (id, session_id, user_id, subject, deadline_at, mode, "
        "hours_available, language, style, plan, cache_key) "
        "values (%s, %s, %s, %s, %s, %s, %s, %s, 'short', %s, %s)",
        (
            plan_id,
            session_id,
            user_id,
            plan["subject"],
            plan["deadline"],
            plan["mode"],
            max(0.5, round(float(plan["hours"]), 1)),
            lang,
            Jsonb({"steps": plan["steps"]}),
            f"{plan['subject']}|{plan['mode']}|{plan['deadline'][:13]}",
        ),
    )
    return plan_id


def _run(
    connect: Connect,
    llm: Llm,
    user_id: str,
    session_id: str,
    text: str,
    language: Lang | None = None,
    client_message_id: str | None = None,
    now: datetime | None = None,
) -> Iterator[str]:
    now = now or datetime.now(UTC)
    with connect() as conn:
        conn.execute(
            "insert into public.messages (id, session_id, user_id, role, content) "
            "values (%s, %s, %s, 'user', %s) on conflict (id) do nothing",
            (client_message_id or str(uuid.uuid4()), session_id, user_id, text),
        )
        conn.commit()
        ctx = _context(conn, user_id, session_id, language, now)
        rule = parse_request(text, now).intent
        intent, _ = intent_model.predict(text, rule)
        reply = respond(text, ctx, intent)
        yield sse("status", {"label": _label(reply)})

        blocks = reply.blocks
        served: str = reply.served_from
        if reply.ai_notes is not None:
            t = reply.ai_notes
            try:
                payload, served = content.notes(conn, llm, user_id, t)
            except LlmError:
                payload, served = topic_note(t), "ml"  # syllabus summary, quietly
            blocks = [{**b, "text": payload} if b["type"] == "notes" else b for b in blocks]
        elif reply.ai_study is not None:
            kind, subject, topics = reply.ai_study
            try:
                payload, served = study.generate(
                    conn,
                    llm,
                    user_id,
                    cast("study.Kind", kind),
                    subject,
                    topics,
                    reply.lang or ctx.language,
                )
                blocks = [_study_block(b, kind, payload) for b in blocks]
            except LlmError:
                served = "ml"  # keep the syllabus-built version, quietly
        elif reply.intent in ("ask_about_file", "summarize_file") and reply.open is not None:
            blocks, served = _from_files(conn, llm, user_id, session_id, text, reply, ctx)
        elif reply.open is not None:
            try:
                answer = content.answer_open(
                    conn,
                    llm,
                    user_id,
                    reply.open,
                    reply.lang or ctx.language,
                    _history(conn, user_id, session_id),
                )
                blocks, served = [{"type": "text", "text": answer}], "llm"
            except LlmError as e:
                served = "ml"
                if e.code != "not_configured" or not blocks:
                    blocks = [{"type": "followup", "text": e.message, "chips": ["Try again"]}]

        # Quizzes are graded on the server (D3): store the key, send questions only.
        blocks = [
            {"type": "quiz", "topic": b["topic"], **study.store_quiz(
                conn, user_id, session_id, b["topic"], reply.lang or ctx.language, b["questions"])}
            if b["type"] == "quiz" else b
            for b in blocks
        ]  # fmt: skip

        if reply.pending:
            blocks = [dict(b) for b in blocks]
            for b in blocks:
                if b["type"] == "followup":
                    b["pending"] = reply.pending
                    break

        if reply.plan:
            plan_id = _save_plan(conn, user_id, session_id, reply.plan, reply.lang or ctx.language)
            yield sse("plan", {"id": plan_id, "sessionId": session_id, **reply.plan})
            blocks = [*blocks, {"type": "plan", "planId": plan_id}]
        if reply.session_patch:
            p = reply.session_patch
            conn.execute(
                "update public.study_sessions set title = %s, subject = %s, deadline_at = %s, "
                "mode = %s, "
                "updated_at = now() where id = %s and user_id = %s",
                (p["title"][:120], p["subject"], p["deadline"], p["mode"], session_id, user_id),
            )
            yield sse("session", p)

        for b in blocks:
            yield sse("block", {k: v for k, v in b.items() if k != "pending"})

        message_id = str(uuid.uuid4())
        conn.execute(
            "insert into public.messages "
            "(id, session_id, user_id, role, content, blocks, intent, served_from) "
            "values (%s, %s, %s, 'assistant', '', %s, %s, %s)",
            (message_id, session_id, user_id, Jsonb(blocks), reply.intent, served),
        )
        conn.execute(
            "update public.study_sessions set updated_at = now() where id = %s and user_id = %s",
            (session_id, user_id),
        )
        if served == "ml":
            cache.log_usage(conn, user_id, "message", "ml")
        conn.commit()
        yield sse("done", {"messageId": message_id, "servedFrom": served})


def stream(
    connect: Connect,
    llm: Llm,
    user_id: str,
    session_id: str,
    text: str,
    language: Lang | None = None,
    client_message_id: str | None = None,
    now: datetime | None = None,
) -> Iterator[str]:
    """The plan, the session change and the assistant message commit together after the last
    block. If anything fails, or the student closes the tab, nothing past the user's own message
    is kept (the connection rolls back), and a failure is reported as an `error` event."""
    try:
        yield from _run(connect, llm, user_id, session_id, text, language, client_message_id, now)
    except Exception:
        log.exception("message_stream_failed")
        yield sse(
            "error", {"code": "internal", "message": "Something failed on our side. Try again."}
        )
