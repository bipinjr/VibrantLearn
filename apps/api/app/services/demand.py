"""Tonight's demand (TEACHER.md T2): what students are about to be examined on, for teachers.

Privacy rules, non-negotiable:
- aggregates only: counts per subject and per flagged topic, never a name, username or row;
- any bucket under 5 students is suppressed (AGGREGATE_MIN);
- the requesting teacher's own plans are left out (a teacher can also be a student);
- computed here and returned already aggregated.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from app.services.classes import AGGREGATE_MIN, Conn, rules

WINDOW = timedelta(days=7)
URGENT = timedelta(hours=48)


def board(
    conn: Conn, user_id: str, subjects: list[str], now: datetime | None = None
) -> list[dict[str, Any]]:
    now = now or datetime.now(UTC)
    rows = conn.execute(
        "select p.subject, count(distinct p.user_id) as students, "
        "count(distinct p.user_id) filter (where p.deadline_at < %(urgent)s) as within_48h, "
        "min(p.deadline_at) as soonest "
        "from public.study_plans p join public.study_sessions s on s.id = p.session_id "
        "where s.deleted_at is null and p.user_id <> %(me)s and p.deadline_at > %(now)s and p.deadline_at < %(end)s "
        "group by p.subject having count(distinct p.user_id) >= %(min)s",
        {
            "urgent": now + URGENT,
            "me": user_id,
            "now": now,
            "end": now + WINDOW,
            "min": AGGREGATE_MIN,
        },
    ).fetchall()
    if not rows:
        return []
    weak = conn.execute(
        "select p.subject, lower(w) as topic, count(distinct p.user_id) as students "
        "from public.study_plans p join public.study_sessions s on s.id = p.session_id, "
        "jsonb_array_elements_text(coalesce(p.plan -> 'weak', '[]'::jsonb)) as w "
        "where s.deleted_at is null and p.user_id <> %(me)s and p.deadline_at > %(now)s and p.deadline_at < %(end)s "
        "group by p.subject, lower(w) having count(distinct p.user_id) >= %(min)s "
        "order by students desc",
        {"me": user_id, "now": now, "end": now + WINDOW, "min": AGGREGATE_MIN},
    ).fetchall()
    net = rules()["net_paise"]
    out = []
    for r in rows:
        hours = max(1.0, (r["soonest"] - now).total_seconds() / 3600)
        topics = [
            {"topic": str(w["topic"]), "students": int(w["students"])}
            for w in weak
            if w["subject"] == r["subject"]
        ][:3]
        out.append(
            {
                "subject": r["subject"],
                "students": int(r["students"]),
                "within_48h": int(r["within_48h"]),
                "soonest_at": r["soonest"].isoformat(),
                "weak_topics": topics,
                "yours": r["subject"] in subjects,
                "est_net_paise": net,
                "score": round(int(r["students"]) * (48 / (hours + 6)), 2),
            }
        )
    # The teacher's own subjects first, then by students x urgency.
    out.sort(key=lambda d: (not d["yours"], -d["score"]))
    return out
