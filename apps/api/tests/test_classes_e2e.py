"""Live classes + moderation bot, end to end: real routers, real services, real SQL on a real Postgres.

Runs against DATABASE_URL (local Supabase, or any Postgres with the migrations applied); skipped when
there is none. Times are moved by editing `starts_at`, the same way the clock would move them.
"""

import json
import os
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.llm.client import LlmError, Message, Result, get_llm
from app.main import app
from tests.conftest import make_token


def sql(q: str, args: tuple[Any, ...] = ()) -> list[tuple[Any, ...]]:
    """One short connection per statement (some test servers allow a single connection at a time)."""
    with psycopg.connect(get_settings().database_url.get_secret_value(), connect_timeout=10) as c:
        cur = c.execute(q, args)
        rows = cur.fetchall() if cur.description else []
        c.commit()
        return rows


class Judge:
    """Stands in for Groq: hides what it's told to, or fails."""

    def __init__(self) -> None:
        self.hide: set[str] = set()
        self.down = False
        self.calls = 0

    def chat(self, msgs: list[Message], **kw: Any) -> Result:
        self.calls += 1
        if self.down:
            raise LlmError(503, "llm_unavailable", "down")
        hide = msgs[-1].content in self.hide
        out = {"hide": hide, "category": "abuse" if hide else "none"}
        return Result(json.dumps(out), "fake", 10, 5, 1)


@pytest.fixture
def env(monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[TestClient, Judge]]:
    monkeypatch.setattr(
        get_settings(), "teacher_auto_verify", False
    )  # a local demo .env may turn it on
    if os.environ.get("E2E_DB") != "1":
        pytest.skip("writes real rows: run with E2E_DB=1 against a test database")
    try:
        sql("select 1 from internal.class_messages limit 1")
    except psycopg.Error:
        pytest.skip("no Postgres with the migrations at DATABASE_URL")
    judge = Judge()
    app.dependency_overrides[get_llm] = lambda: judge
    yield TestClient(app), judge
    app.dependency_overrides.clear()


def person(name: str) -> tuple[str, dict[str, str]]:
    uid = str(uuid.uuid4())
    sql("insert into auth.users (id, email) values (%s, %s)", (uid, f"{uid}@test.local"))
    sql("insert into public.profiles (id, username) values (%s, %s)", (uid, f"{name}{uid[:6]}"))
    return uid, {"Authorization": f"Bearer {make_token(uid)}"}


def move(class_id: str, minutes_from_now: float) -> None:
    sql("update public.classes set starts_at = %s where id = %s",
        (datetime.now(UTC) + timedelta(minutes=minutes_from_now), class_id))  # fmt: skip


def new_class(api: TestClient, teacher: dict[str, str], topic: str = "Inheritance") -> str:
    start = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    r = api.post("/api/v1/classes", headers=teacher,
                 json={"subject": "Java Programming", "topic": topic, "starts_at": start, "duration_min": 60})  # fmt: skip
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


def test_live_class_and_moderation_bot(env: tuple[TestClient, Judge]) -> None:
    api, judge = env
    t_id, teacher = person("teacher")

    # apply -> pending -> can't post; verified -> can post
    r = api.post("/api/v1/teachers/apply", headers=teacher,
                 json={"display_name": "Ravi Sir", "subjects": ["Java Programming"], "qualification": "MCA",
                       "experience_years": 6, "languages": ["en", "kn"], "preferred_days": ["mon", "wed"],
                       "preferred_slots": ["7-8pm"], "levels": ["exam_prep"],
                       "organisation": "Seshadripuram College", "consent": True})  # fmt: skip
    assert r.status_code == 200, r.text
    prof = r.json()["teacher"]
    assert (
        prof["status"] == "pending"
        and prof["languages"] == ["en", "kn"]
        and prof["preferred_slots"] == ["7-8pm"]
    )
    # T1: no consent or a subject outside the syllabus is refused; payout details come back masked
    bad = {"display_name": "Ravi Sir", "subjects": ["Java Programming"], "consent": False}
    assert api.post("/api/v1/teachers/apply", headers=teacher, json=bad).status_code == 422
    bad = {"display_name": "Ravi Sir", "subjects": ["Astrology"], "consent": True}
    assert api.post("/api/v1/teachers/apply", headers=teacher, json=bad).status_code == 422
    p = api.put(
        "/api/v1/teachers/payout",
        headers=teacher,
        json={"method": "upi", "upi_id": "ravikumar@okaxis"},
    )
    assert (
        p.status_code == 200
        and p.json()["payout"]["display"].startswith("ra")
        and "vikumar" not in p.json()["payout"]["display"]
    )
    assert (
        api.put(
            "/api/v1/teachers/payout", headers=teacher, json={"method": "bank", "ifsc": "nope"}
        ).status_code
        == 422
    )
    me = api.get("/api/v1/teachers/me", headers=teacher).json()
    assert (
        me["payout"]["method"] == "upi" and me["teacher"]["organisation"] == "Seshadripuram College"
    )
    # a teacher can't see the review queue or approve themselves
    assert api.get("/api/v1/review/teachers", headers=teacher).status_code == 404
    assert (
        api.post(
            f"/api/v1/review/teachers/{t_id}", headers=teacher, json={"decision": "verify"}
        ).status_code
        == 404
    )
    # a reviewer rejects with a reason; resubmitting puts it back in the queue
    rv_id, reviewer = person("reviewer")
    sql("insert into internal.reviewers (user_id) values (%s)", (rv_id,))
    assert any(
        x["user_id"] == t_id
        for x in api.get("/api/v1/review/teachers", headers=reviewer).json()["teachers"]
    )
    assert (
        api.post(
            f"/api/v1/review/teachers/{t_id}", headers=reviewer, json={"decision": "reject"}
        ).status_code
        == 422
    )
    rj = api.post(
        f"/api/v1/review/teachers/{t_id}",
        headers=reviewer,
        json={"decision": "reject", "note": "Document is blurry."},
    )
    assert rj.json()["status"] == "rejected"
    me = api.get("/api/v1/teachers/me", headers=teacher).json()["teacher"]
    assert me["status"] == "rejected" and me["review_note"] == "Document is blurry."
    resubmit = {"display_name": "Ravi Sir", "subjects": ["Java Programming"], "consent": True}
    assert (
        api.post("/api/v1/teachers/apply", headers=teacher, json=resubmit).json()["teacher"][
            "status"
        ]
        == "pending"
    )

    start = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    body = {
        "subject": "Java Programming",
        "topic": "Inheritance",
        "starts_at": start,
        "duration_min": 60,
    }
    assert api.post("/api/v1/classes", headers=teacher, json=body).status_code == 403
    ok = api.post(f"/api/v1/review/teachers/{t_id}", headers=reviewer, json={"decision": "verify"})
    assert ok.json()["status"] == "verified"
    cid = new_class(api, teacher)

    # 12 students mark interested; queue order is kept; one more student never does
    students = [person(f"stu{i}") for i in range(12)]
    for _, h in students:
        assert api.put(f"/api/v1/classes/{cid}/interest", headers=h).status_code == 200
    row = next(
        c
        for c in api.get("/api/v1/classes", headers=students[2][1]).json()["classes"]
        if c["id"] == cid
    )
    assert (row["interested"], row["position"], row["phase"]) == (12, 3, "upcoming")
    _, late = person("late")

    # doors: teacher 5 min early yes, student no
    move(cid, 5)
    room = api.post(f"/api/v1/classes/{cid}/join", headers=teacher).json()
    assert room["role"] == "teacher" and room["room_url"].startswith("https://meet.jit.si/vl-")
    r = api.post(f"/api/v1/classes/{cid}/join", headers=students[0][1])
    assert r.status_code == 409 and "Doors open" in r.json()["error"]["message"]

    # grace: interested first, the latecomer waits
    move(cid, -0.5)
    s0_id, s0 = students[0]
    _, s1 = students[1]
    assert api.post(f"/api/v1/classes/{cid}/join", headers=s0).status_code == 200
    assert api.post(f"/api/v1/classes/{cid}/join", headers=s1).status_code == 200
    r = api.post(f"/api/v1/classes/{cid}/join", headers=late)
    assert r.status_code == 409 and "first 2 minutes" in r.json()["error"]["message"]
    move(cid, -3)
    assert api.post(f"/api/v1/classes/{cid}/join", headers=late).status_code == 200

    # no rating while the class is running
    assert (
        api.put(
            f"/api/v1/classes/{cid}/rating", headers=students[1][1], json={"stars": 5}
        ).status_code
        == 409
    )

    # chat: only people in the room
    outsider = person("out")[1]
    assert api.get(f"/api/v1/classes/{cid}/chat", headers=outsider).status_code == 403

    def say(h: dict[str, str], text: str) -> dict[str, Any]:
        r = api.post(f"/api/v1/classes/{cid}/chat", headers=h, json={"body": text})
        assert r.status_code == 200, r.text
        return dict(r.json())

    ok = say(s0, "Sir, can you explain method overriding again?")
    assert ok["message"]["hidden"] is None and ok["strikes"] == 0
    assert say(teacher, "Slides: https://example.com/unit3")["message"]["hidden"] is None

    run = uuid.uuid4().hex[:6]  # the LLM verdict cache outlives a run
    calls = judge.calls
    assert say(s1, f"this topic is stupid {run}")["message"]["hidden"] is None  # LLM says fine
    assert judge.calls == calls + 1
    judge.down = True
    assert (
        say(s1, f"this unit is useless {run}")["message"]["hidden"] is None
    )  # LLM down -> allowed
    judge.down = False

    r1 = say(s0, "you are a fucking idiot")
    assert r1["message"]["hidden"] and r1["strikes"] == 1 and not r1["removed"]
    judge.hide.add(f"you are dumb {run}")
    assert say(s0, f"you are dumb {run}")["strikes"] == 2  # LLM hides it
    r3 = say(s0, "call me 98450 12345")
    assert r3["strikes"] == 3 and r3["removed"]

    # what others see: no hidden text, bot notices by username
    seen = api.get(f"/api/v1/classes/{cid}/chat", headers=s1).json()["messages"]
    bodies = [m["body"] for m in seen]
    assert "you are a fucking idiot" not in bodies and "call me 98450 12345" not in bodies
    notices = [m["body"] for m in seen if m["bot"]]
    assert (
        len(notices) == 3
        and notices[0].endswith("Warning 1 of 3.")
        and notices[2].startswith("Removed ")
    )
    # the author sees their own hidden messages with the reason
    mine = api.get(f"/api/v1/classes/{cid}/chat", headers=s0).json()
    assert mine["removed"] and sum(1 for m in mine["messages"] if m["hidden"]) == 3

    # removed: can't talk, can't rejoin; one account warning
    assert (
        api.post(f"/api/v1/classes/{cid}/chat", headers=s0, json={"body": "sorry"}).status_code
        == 403
    )
    assert api.post(f"/api/v1/classes/{cid}/join", headers=s0).status_code == 403
    assert (
        sql("select count(*) from internal.moderation_warnings where user_id = %s", (s0_id,))[0][0]
        == 1
    )

    # incremental polling
    last = seen[-1]["id"]
    say(s1, "thank you sir")
    newer = api.get(f"/api/v1/classes/{cid}/chat?after={last}", headers=late).json()["messages"]
    assert [m["body"] for m in newer] == ["thank you sir"]

    # class ends -> done, teacher earns Rs 1,600 "to be paid"
    move(cid, -61)
    assert (
        next(c for c in api.get("/api/v1/classes", headers=s1).json()["classes"] if c["id"] == cid)[
            "phase"
        ]
        == "done"
    )
    e = api.get("/api/v1/teachers/me", headers=teacher).json()["earnings"]
    assert e["to_be_paid_paise"] == 160_000 and e["classes"][0]["students"] == 3
    assert (
        api.post(f"/api/v1/classes/{cid}/chat", headers=s1, json={"body": "bye"}).status_code == 409
    )

    # ratings: only seated students, after the end
    assert (
        api.put(f"/api/v1/classes/{cid}/rating", headers=s1, json={"stars": 5}).status_code == 200
    )
    assert (
        api.put(f"/api/v1/classes/{cid}/rating", headers=late, json={"stars": 4}).status_code == 200
    )
    assert (
        api.put(f"/api/v1/classes/{cid}/rating", headers=outsider, json={"stars": 1}).status_code
        == 403
    )
    assert (
        api.put(f"/api/v1/classes/{cid}/rating", headers=s1, json={"stars": 9}).status_code == 422
    )
    row = next(
        c for c in api.get("/api/v1/classes", headers=s1).json()["classes"] if c["id"] == cid
    )
    assert row["my_rating"] == 5

    # dashboard numbers come from the database
    st = api.get("/api/v1/teachers/me", headers=teacher).json()["stats"]
    assert (st["rating"], st["ratings"], st["classes_done"], st["students_taught"]) == (
        4.5,
        2,
        1,
        3,
    )
    assert st["focused_subject"] == "Java Programming" and st["interested_total"] == 12

    # withdrawal: to_be_paid -> requested, once
    w = api.post("/api/v1/teachers/withdraw", headers=teacher)
    assert w.status_code == 200 and w.json()["earnings"]["requested_paise"] == 160_000
    assert w.json()["earnings"]["to_be_paid_paise"] == 0
    assert api.post("/api/v1/teachers/withdraw", headers=teacher).status_code == 409


def test_auto_cancel_and_teacher_no_show(env: tuple[TestClient, Judge]) -> None:
    api, _ = env
    t_id, teacher = person("teacher")
    api.post(
        "/api/v1/teachers/apply",
        headers=teacher,
        json={
            "display_name": "Asha Madam",
            "subjects": ["Database Management Systems"],
            "consent": True,
        },
    )
    sql("update public.teachers set status = 'verified' where user_id = %s", (t_id,))
    viewer = person("v")[1]

    few = new_class(api, teacher, "Normalisation")
    for _, h in [person(f"f{i}") for i in range(3)]:
        api.put(f"/api/v1/classes/{few}/interest", headers=h)
    move(few, -1)
    row = next(
        c for c in api.get("/api/v1/classes", headers=viewer).json()["classes"] if c["id"] == few
    )
    assert row["phase"] == "cancelled" and "Fewer than 10" in row["cancel_reason"]

    empty_room = new_class(api, teacher, "Joins")
    for _, h in [person(f"n{i}") for i in range(10)]:
        api.put(f"/api/v1/classes/{empty_room}/interest", headers=h)
    move(empty_room, -11)
    row = next(
        c
        for c in api.get("/api/v1/classes", headers=viewer).json()["classes"]
        if c["id"] == empty_room
    )
    assert row["phase"] == "cancelled" and "teacher didn't join" in row["cancel_reason"]
    assert api.get("/api/v1/teachers/me", headers=teacher).json()["earnings"]["warnings"] == 1
