"""TEACHER.md T2-T10 and rewards, end to end on a real Postgres (opt-in: E2E_DB=1).

Run it against a throwaway database, never production: it creates users, plans and classes.
"""

import uuid
from datetime import UTC, datetime, timedelta

import psycopg
from fastapi.testclient import TestClient
from psycopg.types.json import Jsonb

from tests.test_classes_e2e import Judge, env, move, person, sql  # noqa: F401 - env is a fixture

T = "Database Management Systems"


def plan_for(uid: str, subject: str, hours: int, weak: list[str]) -> None:
    sid = str(uuid.uuid4())
    sql(
        "insert into public.study_sessions (id, user_id, title, subject) values (%s, %s, 'x', %s)",
        (sid, uid, subject),
    )
    sql(
        "insert into public.study_plans (session_id, user_id, subject, deadline_at, mode, language, style, plan, cache_key) "
        "values (%s, %s, %s, %s, 'crash', 'en', 'short', %s, 'k')",
        (
            sid,
            uid,
            subject,
            datetime.now(UTC) + timedelta(hours=hours),
            Jsonb({"steps": [], "weak": weak}),
        ),
    )


def test_teacher_dashboard_and_rewards(env: tuple[TestClient, Judge]) -> None:  # noqa: F811
    api, _ = env
    t_id, teacher = person("teach")
    profile = {
        "display_name": "Asha Madam",
        "subjects": [T],
        "consent": True,
        "organisation": "BCU",
    }
    assert api.post("/api/v1/teachers/apply", headers=teacher, json=profile).status_code == 200

    # T2 demand: 6 students with a DBMS exam tomorrow (5 flag normalization), 4 with Java (suppressed)
    dbms = [person(f"d{i}") for i in range(6)]
    for i, (uid, _) in enumerate(dbms):
        plan_for(uid, T, 20, ["Normalization"] if i < 5 else [])
    for i in range(4):
        plan_for(person(f"j{i}")[0], "Java Programming", 30, ["inheritance"])
    board = api.get("/api/v1/teachers/demand", headers=teacher).json()["demand"]
    mine = [d for d in board if d["subject"] == T]
    assert mine and mine[0]["students"] >= 6 and mine[0]["within_48h"] >= 6 and mine[0]["yours"]
    assert any(w["topic"] == "normalization" and w["students"] >= 5 for w in mine[0]["weak_topics"])
    assert all(d["students"] >= 5 for d in board)  # nothing under 5 ever leaves the server
    assert all("user_id" not in d and "username" not in d for d in board)

    sql("update public.teachers set status = 'verified' where user_id = %s", (t_id,))

    # T3: topics from the syllabus, seat cap; topics from another subject are refused
    topics = api.get("/api/v1/teachers/topics", headers=teacher, params={"subject": T}).json()[
        "topics"
    ]
    assert len(topics) >= 2
    start = (datetime.now(UTC) + timedelta(hours=3)).isoformat()
    body = {"subject": T, "topic": "Normal forms", "starts_at": start, "duration_min": 60,
            "topic_ids": [topics[0]["id"], topics[1]["id"]], "seat_cap": 12}  # fmt: skip
    r = api.post("/api/v1/classes", headers=teacher, json=body)
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    java = api.get(
        "/api/v1/teachers/topics", headers=teacher, params={"subject": "Java Programming"}
    ).json()["topics"]
    assert (
        api.post(
            "/api/v1/classes", headers=teacher, json=body | {"topic_ids": [java[0]["id"]]}
        ).status_code
        == 422
    )
    assert sql(
        "select max_students, cardinality(topic_ids) from public.classes where id = %s", (cid,)
    )[0] == (12, 2)

    # students with a DBMS plan see it marked for them
    row = next(
        c
        for c in api.get("/api/v1/classes", headers=dbms[0][1]).json()["classes"]
        if c["id"] == cid
    )
    assert row["for_you"] and row["max_students"] == 12 and row["teacher_id"] == t_id

    # T4: move it; interest is kept
    for _, h in dbms[:5] + [person(f"x{i}") for i in range(5)]:
        api.put(f"/api/v1/classes/{cid}/interest", headers=h)
    later = (datetime.now(UTC) + timedelta(hours=5)).isoformat()
    assert (
        api.post(
            f"/api/v1/classes/{cid}/reschedule", headers=teacher, json={"starts_at": later}
        ).status_code
        == 204
    )
    assert (
        api.post(
            f"/api/v1/classes/{cid}/reschedule", headers=dbms[0][1], json={"starts_at": later}
        ).status_code
        == 404
    )
    assert sql("select count(*) from public.class_signups where class_id = %s", (cid,))[0][0] == 10

    # T5: before the start the teacher sees no names; after, usernames only
    assert api.get(f"/api/v1/classes/{cid}/people", headers=teacher).json()["people"] == []
    move(cid, -3)
    api.post(f"/api/v1/classes/{cid}/join", headers=teacher)
    _, s_h = dbms[0]
    assert api.post(f"/api/v1/classes/{cid}/join", headers=s_h).status_code == 200
    ppl = api.get(f"/api/v1/classes/{cid}/people", headers=teacher).json()["people"]
    assert len(ppl) == 1 and set(ppl[0]) == {"user_id", "username", "joined_at", "removed"}
    assert (
        api.get(f"/api/v1/classes/{cid}/people", headers=s_h).status_code == 404
    )  # students can't

    q = api.post(
        f"/api/v1/classes/{cid}/chat",
        headers=s_h,
        json={"body": "Why is BCNF stricter than 3NF?", "is_question": True},
    ).json()
    assert q["message"]["question"] and not q["message"]["answered"]
    mid = q["message"]["id"]
    assert api.post(f"/api/v1/classes/{cid}/chat/{mid}/answered", headers=s_h).status_code == 403
    assert (
        api.post(f"/api/v1/classes/{cid}/chat/{mid}/answered", headers=teacher).status_code == 204
    )
    msgs = api.get(f"/api/v1/classes/{cid}/chat", headers=teacher).json()["messages"]
    assert next(m for m in msgs if m["id"] == mid)["answered"]

    # T5/T9: report with an outcome the reporter sees
    assert (
        api.post(
            f"/api/v1/classes/{cid}/report",
            headers=teacher,
            json={"reason": "Spamming the chat", "message_id": mid},
        ).status_code
        == 201
    )
    outsider = person("o")[1]
    assert (
        api.post(
            f"/api/v1/classes/{cid}/report", headers=outsider, json={"reason": "spam"}
        ).status_code
        == 403
    )
    rv_id, reviewer = person("rev")
    sql("insert into internal.reviewers (user_id) values (%s)", (rv_id,))
    cases = api.get("/api/v1/review/cases", headers=reviewer).json()
    fid = cases["reports"][0]["id"]
    assert api.get("/api/v1/review/cases", headers=teacher).status_code == 404
    api.post(
        f"/api/v1/review/reports/{fid}",
        headers=reviewer,
        json={"decision": False, "outcome": "A real question, not spam."},
    )
    rep = api.get("/api/v1/teachers/health", headers=teacher).json()["reports"]
    assert rep[0]["status"] == "dismissed" and rep[0]["outcome"] == "A real question, not spam."

    # T6: after the class, aggregates only, and one tap to run it again
    move(cid, -70)
    api.put(f"/api/v1/classes/{cid}/rating", headers=s_h, json={"stars": 5})
    summ = api.get(f"/api/v1/classes/{cid}/summary", headers=teacher).json()
    assert (summ["attended"], summ["interested"], summ["ratings"]) == (1, 10, 1) and summ["payout"][
        "net_paise"
    ] == 160_000
    assert summ["quiz_feedback"] == []  # fewer than 5 attendees took quizzes: suppressed
    new_id = api.post(f"/api/v1/classes/{cid}/repeat", headers=teacher, json={"days": 7}).json()[
        "id"
    ]
    assert sql("select repeat_of::text from public.classes where id = %s", (new_id,))[0][0] == cid

    # T8: public profile
    pub = api.get(f"/api/v1/teachers/{t_id}/public", headers=s_h).json()["teacher"]
    assert (
        pub["verified"]
        and pub["classes_taught"] == 1
        and pub["attendance_rate"] == 10
        and pub["rating"] == 5.0
    )

    # T9: a warning, an appeal, removed on review: it stops counting
    sql(
        "insert into internal.moderation_warnings (user_id, class_id, reason) values (%s, %s, 'Didn''t join their own class.')",
        (t_id, cid),
    )
    w = api.get("/api/v1/teachers/health", headers=teacher).json()["warnings"][0]
    assert (
        api.post(
            "/api/v1/teachers/appeals",
            headers=teacher,
            json={"warning_id": w["id"], "body": "My internet was down; I emailed support."},
        ).status_code
        == 201
    )
    aid = api.get("/api/v1/review/cases", headers=reviewer).json()["appeals"][0]["id"]
    assert (
        api.post(
            f"/api/v1/review/appeals/{aid}",
            headers=reviewer,
            json={"decision": True, "outcome": "Outage confirmed."},
        ).json()["status"]
        == "removed"
    )
    assert api.get("/api/v1/teachers/me", headers=teacher).json()["earnings"]["warnings"] == 0
    assert (
        api.get("/api/v1/teachers/health", headers=teacher).json()["warnings"][0]["appeal"][
            "status"
        ]
        == "removed"
    )

    # T10: notification settings
    assert (
        api.put(
            "/api/v1/teachers/notify",
            headers=teacher,
            json={"class_reminders": False, "demand_alerts": True},
        ).status_code
        == 200
    )

    # Rewards: the live class counts; leaderboard only lists students who opted in
    me = api.get("/api/v1/me/rewards", headers=s_h).json()
    assert me["total"] >= 30 and next(b for b in me["badges"] if b["id"] == "live")["earned"]
    assert not me["on_leaderboard"]
    assert api.get("/api/v1/me/rewards/leaderboard", headers=s_h).json()["my_rank"] is None
    api.put("/api/v1/me/rewards/optin", headers=s_h, json={"on": True})
    lb = api.get("/api/v1/me/rewards/leaderboard", headers=s_h).json()
    assert lb["my_rank"] is not None and any(x["me"] and x["points"] >= 30 for x in lb["board"])
    assert set(lb["board"][0]) == {"rank", "username", "points", "me"}


def test_rls_new_tables_closed() -> None:
    """Clients (authenticated role) can't read any of the new server-only tables."""
    import os

    import pytest

    if os.environ.get("E2E_DB") != "1":
        pytest.skip("needs E2E_DB=1")
    from app.core.config import get_settings

    for table in (
        "internal.moderation_flags",
        "internal.appeals",
        "internal.reward_optin",
        "internal.teacher_documents",
    ):
        with psycopg.connect(get_settings().database_url.get_secret_value()) as c:
            c.execute("set role authenticated")
            try:
                c.execute(f"select 1 from {table} limit 1")  # noqa: S608 - fixed table names
                raise AssertionError(f"{table} is readable by clients")
            except psycopg.errors.InsufficientPrivilege:
                pass
