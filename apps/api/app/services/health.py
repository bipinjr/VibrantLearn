"""Account health (TEACHER.md T9) and reports from inside a class (T5).

- Every warning shows its reason and the class it came from, and can be appealed once.
- A teacher or a student in a class can report someone in it; the reporter sees the outcome.
- Reviewers (internal.reviewers) decide appeals and reports. A removed warning stops counting.
"""

from typing import Any

from app.core import audit
from app.core.errors import ApiError
from app.services.classes import WARNINGS_TO_SUSPEND, Conn
from app.services.classes import warnings as warnings_count
from app.services.teachers import _reviewer


def warnings(conn: Conn, user_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "select w.id, w.created_at, w.reason, c.topic, c.starts_at, a.status as appeal_status, a.outcome as appeal_outcome "
        "from internal.moderation_warnings w left join public.classes c on c.id = w.class_id "
        "left join internal.appeals a on a.warning_id = w.id where w.user_id = %s order by w.created_at desc",
        (user_id,),
    ).fetchall()
    return [
        {
            "id": int(r["id"]),
            "at": r["created_at"].isoformat(),
            "reason": r["reason"],
            "class_topic": r["topic"],
            "class_at": r["starts_at"].isoformat() if r["starts_at"] else None,
            "appeal": {"status": r["appeal_status"], "outcome": r["appeal_outcome"]}
            if r["appeal_status"]
            else None,
        }
        for r in rows
    ]


def appeal(conn: Conn, user_id: str, warning_id: int, body: str) -> dict[str, Any]:
    w = conn.execute(
        "select id from internal.moderation_warnings where id = %s and user_id = %s",
        (warning_id, user_id),
    ).fetchone()
    if not w:
        raise ApiError(404, "not_found", "That warning doesn't exist.")
    conn.execute(
        "insert into internal.appeals (warning_id, user_id, body) values (%s, %s, %s) on conflict (warning_id) do nothing",
        (warning_id, user_id, body),
    )
    conn.commit()
    return {"status": "open"}


def report(
    conn: Conn,
    user_id: str,
    class_id: str,
    reason: str,
    reported_id: str | None = None,
    message_id: int | None = None,
) -> dict[str, Any]:
    """Only people who were in the class (teacher or seated student) can report someone in it."""
    inside = conn.execute(
        "select 1 from public.class_attendance where class_id = %s and user_id = %s "
        "union select 1 from public.classes where id = %s and teacher_id = %s",
        (class_id, user_id, class_id, user_id),
    ).fetchone()
    if not inside:
        raise ApiError(403, "forbidden", "Only people in this class can report something in it.")
    if reported_id:
        there = conn.execute(
            "select 1 from public.class_attendance where class_id = %s and user_id = %s "
            "union select 1 from public.classes where id = %s and teacher_id = %s",
            (class_id, reported_id, class_id, reported_id),
        ).fetchone()
        if not there or reported_id == user_id:
            raise ApiError(
                422, "invalid_input", "You can only report someone else who is in this class."
            )
    if message_id is not None:
        m = conn.execute(
            "select user_id from internal.class_messages where id = %s and class_id = %s",
            (message_id, class_id),
        ).fetchone()
        if not m or m["user_id"] is None:
            raise ApiError(422, "invalid_input", "That message isn't in this class.")
        reported_id = reported_id or str(m["user_id"])
    conn.execute(
        "insert into internal.moderation_flags (class_id, reporter_id, reported_id, message_id, reason) "
        "values (%s, %s, %s, %s, %s)",
        (class_id, user_id, reported_id, message_id, reason),
    )
    conn.commit()
    return {"status": "open"}


def my_reports(conn: Conn, user_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "select f.id, f.created_at, f.reason, f.status, f.outcome, c.topic from internal.moderation_flags f "
        "left join public.classes c on c.id = f.class_id where f.reporter_id = %s order by f.created_at desc limit 50",
        (user_id,),
    ).fetchall()
    return [
        {
            "id": int(r["id"]),
            "at": r["created_at"].isoformat(),
            "reason": r["reason"],
            "status": r["status"],
            "outcome": r["outcome"],
            "class_topic": r["topic"],
        }
        for r in rows
    ]


def open_cases(conn: Conn, reviewer_id: str) -> dict[str, list[dict[str, Any]]]:
    _reviewer(conn, reviewer_id)
    appeals = conn.execute(
        "select a.id, a.body, a.created_at, w.reason, u.email from internal.appeals a "
        "join internal.moderation_warnings w on w.id = a.warning_id join auth.users u on u.id = a.user_id "
        "where a.status = 'open' order by a.created_at"
    ).fetchall()
    flags = conn.execute(
        "select f.id, f.reason, f.created_at, c.topic, ru.email as reporter, du.email as reported, m.body as message "
        "from internal.moderation_flags f left join public.classes c on c.id = f.class_id "
        "join auth.users ru on ru.id = f.reporter_id left join auth.users du on du.id = f.reported_id "
        "left join internal.class_messages m on m.id = f.message_id where f.status = 'open' order by f.created_at"
    ).fetchall()
    return {
        "appeals": [
            {
                "id": int(r["id"]),
                "body": r["body"],
                "reason": r["reason"],
                "email": r["email"],
                "at": r["created_at"].isoformat(),
            }
            for r in appeals
        ],
        "reports": [
            {
                "id": int(r["id"]),
                "reason": r["reason"],
                "class_topic": r["topic"],
                "reporter": r["reporter"],
                "reported": r["reported"],
                "message": r["message"],
                "at": r["created_at"].isoformat(),
            }
            for r in flags
        ],
    }


def decide_appeal(
    conn: Conn, reviewer_id: str, appeal_id: int, remove: bool, outcome: str
) -> dict[str, str]:
    _reviewer(conn, reviewer_id)
    a = conn.execute(
        "select warning_id, user_id from internal.appeals where id = %s", (appeal_id,)
    ).fetchone()
    if not a:
        raise ApiError(404, "not_found", "No such appeal.")
    status = "removed" if remove else "upheld"
    conn.execute(
        "update internal.appeals set status = %s, outcome = %s where id = %s",
        (status, outcome, appeal_id),
    )
    if remove and warnings_count(conn, str(a["user_id"])) < WARNINGS_TO_SUSPEND:
        # A warning removed on appeal stops counting (classes.warnings); lift a suspension it caused.
        conn.execute(
            "update public.teachers set status = 'verified' where user_id = %s and status = 'suspended'",
            (a["user_id"],),
        )
    audit.record(
        conn, f"appeal_{status}", reviewer_id, meta={"appeal": appeal_id, "outcome": outcome}
    )
    conn.commit()
    return {"status": status}


def decide_report(
    conn: Conn, reviewer_id: str, flag_id: int, action: bool, outcome: str
) -> dict[str, str]:
    _reviewer(conn, reviewer_id)
    status = "actioned" if action else "dismissed"
    n = conn.execute(
        "update internal.moderation_flags set status = %s, outcome = %s where id = %s and status = 'open'",
        (status, outcome, flag_id),
    ).rowcount
    if not n:
        raise ApiError(404, "not_found", "No such open report.")
    audit.record(conn, f"report_{status}", reviewer_id, meta={"flag": flag_id})
    conn.commit()
    return {"status": status}
