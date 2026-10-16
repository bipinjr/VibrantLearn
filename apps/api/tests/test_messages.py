"""B2/B3: POST /sessions/{id}/messages parses, plans and answers on the server, streams SSE, and
never leaves a half-written row."""

import json
import uuid
from collections.abc import Iterator
from datetime import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.db import get_conn, get_connect
from app.llm.client import LlmError, Message, Result, get_llm
from app.llm.prompts import (
    NOTES_REVIEW,
    NOTES_WRITE,
    STUDY_REVIEW,
    STUDY_TRANSLATE,
    STUDY_WRITE,
    TRANSLATE,
)
from app.main import app
from app.services import messages, syllabus
from tests.conftest import make_token
from tests.fake_db import FakeDb
from tests.test_parity import FIX

A, B = str(uuid.uuid4()), str(uuid.uuid4())
SA, SB = str(uuid.uuid4()), str(uuid.uuid4())
NOTE_EN = "Normalization organises tables so each fact is stored once. " * 4
NOW = datetime.fromisoformat("2026-10-08T15:00:00+00:00")  # Thu 8:30 PM IST


QUIZ_Q = {
    "options": ["this", "super", "extends", "final"],
    "answer": 1,
    "why": "super calls the parent version.",
    "topic": "Method overriding and dynamic dispatch",
}
STUDY_JSON = {
    "quiz": json.dumps({"questions": [{"q": f"AI question {i}?", **QUIZ_Q} for i in range(5)]}),
    "important_questions": json.dumps(
        {"items": [{"marks": m, "q": f"AI {m}-mark question"} for m in (2, 2, 5, 5, 10)]}
    ),
    "pyq": json.dumps(
        {"items": [{"marks": m, "q": f"Past-paper style {m}"} for m in (2, 2, 5, 5, 10)]}
    ),
    "flashcards": json.dumps(
        {"cards": [{"front": f"Term {i}", "back": f"Meaning {i}"} for i in range(6)]}
    ),
}


class FakeLlm:
    def __init__(self, fail: LlmError | Exception | None = None) -> None:
        self.fail = fail
        self.calls: list[str] = []

    def chat(self, msgs: list[Message], **kw: Any) -> Result:
        system = msgs[0].content
        kind = (
            "write" if system == NOTES_WRITE else "review" if system == NOTES_REVIEW
            else "translate" if system == TRANSLATE else "chat"
        )  # fmt: skip
        study = next((k for k, v in STUDY_WRITE.items() if v == system), None)
        if study or system in (STUDY_REVIEW,) or system.startswith(STUDY_TRANSLATE[:40]):
            kind = (
                f"study:{study}"
                if study
                else "study:review"
                if system == STUDY_REVIEW
                else "study:translate"
            )
        self.calls.append(kind)
        if self.fail:
            raise self.fail
        if kind.startswith("study:"):
            text = STUDY_JSON[study] if study else msgs[1].content.split("Material to check:\n")[-1]
            return Result(text=text, model=kw["model"], tokens_in=1, tokens_out=1, latency_ms=1)
        text = {
            "write": NOTE_EN,
            "review": NOTE_EN,
            "translate": json.dumps(
                {"kn": "Normalization ಬಗ್ಗೆ ಕನ್ನಡ ಟಿಪ್ಪಣಿ. " * 6, "hi": "Normalization पर हिंदी नोट। " * 6}
            ),
            "chat": "**Bengaluru** is the capital of Karnataka.",
        }[kind]
        return Result(text=text, model=kw["model"], tokens_in=10, tokens_out=20, latency_ms=5)


@pytest.fixture
def db() -> FakeDb:
    d = FakeDb(FIX["syllabus"])
    d.state["sessions"] = {
        SA: {"user_id": A, "subject": None, "title": "New study session"},
        SB: {"user_id": B, "subject": None, "title": "B's session"},
    }
    d.state["profiles"] = {A: {"language": "en"}, B: {"language": "en"}}
    d.commit()
    return d


@pytest.fixture
def llm() -> FakeLlm:
    return FakeLlm()


@pytest.fixture
def client(db: FakeDb, llm: FakeLlm, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    syllabus.clear()
    real = messages._run
    monkeypatch.setattr(messages, "_run", lambda *a: real(*a[:7], NOW))  # fixed clock
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_connect] = lambda: db.connect
    app.dependency_overrides[get_llm] = lambda: llm
    yield TestClient(app)
    app.dependency_overrides.clear()


def send(client: TestClient, text: str, uid: str = A, sid: str = SA) -> list[tuple[str, Any]]:
    r = client.post(
        f"/api/v1/sessions/{sid}/messages",
        json={"text": text},
        headers={"Authorization": f"Bearer {make_token(uid)}"},
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("text/event-stream")
    events = []
    for chunk in r.text.strip().split("\n\n"):
        ev, data = chunk.split("\n", 1)
        events.append((ev.removeprefix("event: "), json.loads(data.removeprefix("data: "))))
    return events


def assistant(db: FakeDb) -> list[dict[str, Any]]:
    return [m for m in db.state["messages"] if m["role"] == "assistant"]


# ---- the contract every endpoint keeps -----------------------------------------------------------


def test_needs_a_token(client: TestClient) -> None:
    assert client.post(f"/api/v1/sessions/{SA}/messages", json={"text": "hi"}).status_code == 401


@pytest.mark.parametrize(
    "body", [{"text": ""}, {"text": "x" * 4001}, {"text": "hi", "sneaky": 1}, {}]
)
def test_malformed_body_is_refused(client: TestClient, body: dict[str, Any]) -> None:
    r = client.post(
        f"/api/v1/sessions/{SA}/messages",
        json=body,
        headers={"Authorization": f"Bearer {make_token(A)}"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_input"


def test_cannot_post_into_another_students_session(client: TestClient, db: FakeDb) -> None:
    r = client.post(
        f"/api/v1/sessions/{SB}/messages",
        json={"text": "hi"},
        headers={"Authorization": f"Bearer {make_token(A)}"},
    )
    assert r.status_code == 404
    assert db.state["messages"] == []


def test_rate_limited_with_retry_after(client: TestClient, db: FakeDb) -> None:
    db.state["rate"][(A, "messages")] = 30
    r = client.post(
        f"/api/v1/sessions/{SA}/messages",
        json={"text": "hi"},
        headers={"Authorization": f"Bearer {make_token(A)}"},
    )
    assert r.status_code == 429 and r.headers["Retry-After"]


# ---- what students actually do -------------------------------------------------------------------


def test_kanglish_request_then_hours_builds_a_plan_on_the_server(
    client: TestClient, db: FakeDb
) -> None:
    ev = send(client, "nale DBMS test ide, normalization weak")
    blocks = [d for e, d in ev if e == "block"]
    assert blocks[0]["type"] == "followup" and "How many hours" in blocks[0]["text"]
    assert "pending" not in blocks[0]  # internal state never reaches the browser
    assert assistant(db)[-1]["blocks"][0]["pending"]["awaiting"] == "hours"

    ev = send(client, "2 hours")
    names = [e for e, _ in ev]
    assert names.index("plan") < names.index("block") < names.index("done")
    plan = next(d for e, d in ev if e == "plan")
    assert plan["subject"] == "Database Management Systems" and plan["mode"] == "crash"
    assert any(s["kind"] == "block" for s in plan["steps"])
    assert db.state["plans"][0]["id"] == plan["id"]
    assert db.state["sessions"][SA]["title"] == "DBMS test"
    blocks = [d for e, d in ev if e == "block"]
    assert "comes first because you said it's a weak spot" in blocks[0]["text"]
    assert blocks[-1] == {"type": "plan", "planId": plan["id"]}
    assert ev[-1][1]["servedFrom"] == "ml"


def test_notes_are_ai_written_once_then_served_from_the_shared_cache(
    client: TestClient, llm: FakeLlm
) -> None:
    ev = send(client, "normalization bagge heli")
    note = next(d for e, d in ev if e == "block")
    assert note["type"] == "notes" and note["lang"] == "kn"
    assert note["text"]["en"].startswith("Normalization organises") and "ಕನ್ನಡ" in note["text"]["kn"]
    assert llm.calls == ["write", "review", "translate"]
    assert ev[-1][1]["servedFrom"] == "llm"

    ev = send(client, "explain normalization")
    assert ev[-1][1]["servedFrom"] == "cache"
    assert llm.calls == ["write", "review", "translate"]  # no second round of AI calls


def test_ai_down_falls_back_to_the_syllabus_note_quietly(client: TestClient, db: FakeDb) -> None:
    app.dependency_overrides[get_llm] = lambda: FakeLlm(LlmError(429, "llm_busy", "busy"))
    ev = send(client, "explain normalization")
    note = next(d for e, d in ev if e == "block")
    assert note["type"] == "notes" and "Unit" in note["text"]["en"]
    assert ev[-1][1]["servedFrom"] == "ml"
    assert not [e for e, _ in ev if e == "error"]


def test_open_question_answered_in_plain_text(client: TestClient) -> None:
    ev = send(client, "what is the capital of karnataka")
    block = next(d for e, d in ev if e == "block")
    assert block == {
        "type": "text",
        "text": "Bengaluru is the capital of Karnataka.",
    }  # markdown stripped


def test_open_question_when_ai_is_busy_offers_a_retry(client: TestClient) -> None:
    app.dependency_overrides[get_llm] = lambda: FakeLlm(
        LlmError(429, "llm_busy", "The AI is busy right now.")
    )
    block = next(d for e, d in send(client, "who won the cricket match") if e == "block")
    assert block["type"] == "followup" and block["chips"] == ["Try again"]


def test_ai_quiz_reaches_the_browser_without_its_answer_key(
    client: TestClient, db: FakeDb, llm: FakeLlm
) -> None:
    ev = send(client, "quiz me on inheritance")
    block = next(d for e, d in ev if e == "block")
    assert block["type"] == "quiz" and block["contentId"]
    assert block["questions"][0]["q"] == "AI question 0?"
    assert all(set(q) == {"q", "options", "topic"} for q in block["questions"])  # no answer, no why
    assert (
        db.state["quiz_keys"][block["contentId"]]["answers"] == [1] * 5
    )  # the key stays server-side
    assert llm.calls == ["study:quiz", "study:review"]  # English, so no translation step


def test_quiz_falls_back_to_the_syllabus_version_when_ai_is_down(
    client: TestClient, db: FakeDb
) -> None:
    app.dependency_overrides[get_llm] = lambda: FakeLlm(LlmError(429, "llm_busy", "busy"))
    block = next(d for e, d in send(client, "quiz me on dbms") if e == "block")
    assert block["type"] == "quiz" and len(block["questions"]) == 5 and block["contentId"]
    assert "answer" not in block["questions"][0]


def test_ai_questions_and_flashcards(client: TestClient) -> None:
    q = next(d for e, d in send(client, "important questions for java") if e == "block")
    assert [i["marks"] for i in q["items"]] == [2, 2, 5, 5, 10] and q["items"][0][
        "q"
    ] == "AI 2-mark question"
    f = next(d for e, d in send(client, "flashcards for java") if e == "block")
    assert f["cards"][0] == {"front": "Term 0", "back": "Meaning 0"}


# ---- no half-written rows ------------------------------------------------------------------------


def test_closing_the_tab_mid_stream_keeps_only_the_students_message(
    db: FakeDb, llm: FakeLlm
) -> None:
    syllabus.clear()
    db.state["messages"].append(
        {
            "id": "m0", "session_id": SA, "user_id": A, "role": "assistant", "content": "",
            "blocks": [{"type": "followup", "text": "hours?", "chips": [],
                        "pending": {"subject": "Database Management Systems",
                                    "deadline": "2026-10-09T04:30:00.000Z", "awaiting": "hours"}}],
        }
    )  # fmt: skip
    db.commit()
    gen = messages.stream(db.connect, llm, A, SA, "3 hours", None, None, NOW)
    seen = [next(gen) for _ in range(2)]  # status, plan ... then the student leaves
    assert seen[1].startswith("event: plan")
    gen.close()
    assert [m["role"] for m in db.state["messages"]] == ["assistant", "user"]
    assert db.state["plans"] == []
    assert db.state["sessions"][SA]["title"] == "New study session"


def test_an_unexpected_failure_is_reported_and_nothing_is_kept(db: FakeDb) -> None:
    syllabus.clear()
    events = list(
        messages.stream(
            db.connect,
            FakeLlm(RuntimeError("boom")),
            A,
            SA,
            "explain normalization",
            None,
            None,
            NOW,
        )
    )
    assert events[-1].startswith("event: error")
    assert "internal" in events[-1] and "boom" not in events[-1]
    assert assistant(db) == []


# ---- limits inside the stream (F1) ------------------------------------------------------------


def test_over_the_ai_limit_shows_the_syllabus_version_and_when_it_resets(
    client: TestClient, db: FakeDb, llm: FakeLlm
) -> None:
    db.state["rate"][(A, "content")] = 40
    ev = send(client, "explain normalization")
    blocks = [d for e, d in ev if e == "block"]
    assert blocks[0]["type"] == "notes" and "Unit" in blocks[0]["text"]["en"]  # syllabus note
    assert "You can try again at" in blocks[-1]["text"]
    assert llm.calls == [] and ev[-1][1]["servedFrom"] == "ml"
    assert db.state["audit"][-1]["action"] == "rate_limited"


def test_over_the_plan_limit_saves_no_plan(client: TestClient, db: FakeDb) -> None:
    db.state["rate"][(A, "plans")] = 10
    ev = send(client, "java exam in 2 hrs")
    assert "plan" not in [e for e, _ in ev]
    assert db.state["plans"] == []
    assert "You've made 10 plans this hour" in next(d for e, d in ev if e == "block")["text"]


def test_endpoint_limits_say_when_they_reset(client: TestClient, db: FakeDb) -> None:
    db.state["rate"][(A, "messages")] = 30
    r = client.post(
        f"/api/v1/sessions/{SA}/messages",
        json={"text": "hi"},
        headers={"Authorization": f"Bearer {make_token(A)}"},
    )
    assert r.status_code == 429 and "You can try again at" in r.json()["error"]["message"]
