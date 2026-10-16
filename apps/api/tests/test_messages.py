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
from app.llm.prompts import NOTES_REVIEW, NOTES_WRITE, TRANSLATE
from app.main import app
from app.services import messages, syllabus
from tests.conftest import make_token
from tests.fake_db import FakeDb
from tests.test_parity import FIX

A, B = str(uuid.uuid4()), str(uuid.uuid4())
SA, SB = str(uuid.uuid4()), str(uuid.uuid4())
NOTE_EN = "Normalization organises tables so each fact is stored once. " * 4
NOW = datetime.fromisoformat("2026-10-08T15:00:00+00:00")  # Thu 8:30 PM IST


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
        self.calls.append(kind)
        if self.fail:
            raise self.fail
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


def test_quiz_needs_no_ai_call(client: TestClient, llm: FakeLlm) -> None:
    block = next(d for e, d in send(client, "quiz me on inheritance") if e == "block")
    assert block["type"] == "quiz" and len(block["questions"]) == 5
    assert llm.calls == []


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
