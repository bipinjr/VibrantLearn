"""Rewards: effort points, streaks, badges and an opt-in weekly leaderboard (owner decision 2026-10-17).

Points reward studying, never marks: a quiz counts the same however you score, plus a small bonus
at 80%. Daily caps stop farming from client-writable rows (checkpoint ticks, flashcard reviews).
The leaderboard shows only students who chose to join it, by username, and nothing else.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from app.services.classes import Conn

IST = timedelta(minutes=330)
POINTS = {"checkpoint": 10, "quiz": 15, "quiz_bonus": 10, "card": 1, "class": 30}
DAILY_CAP = {"checkpoint": 10, "quiz": 10, "card": 50}  # counted events per day
BADGES = [
    ("first_step", "First step", "Ticked your first checkpoint"),
    ("quiz_five", "Quiz habit", "Finished 5 quizzes"),
    ("sharp", "80% club", "Scored 80% or more on a quiz"),
    ("live", "Showed up", "Attended a live class"),
    ("cards_100", "Card shark", "Reviewed 100 flashcards"),
    ("streak_7", "Seven evenings", "Studied 7 days in a row"),
]

_EVENTS = """
with ev as (
  select user_id, ((done_at + interval '330 minutes')::date) as d, 'checkpoint' as k, 10 as pts
    from public.plan_checkpoints where done_at is not null and done_at >= %(since)s and user_id = any(%(users)s)
  union all
  select user_id, ((created_at + interval '330 minutes')::date), 'quiz',
         15 + case when score::numeric / total >= 0.8 then 10 else 0 end
    from public.quiz_attempts where created_at >= %(since)s and user_id = any(%(users)s)
  union all
  select user_id, ((created_at + interval '330 minutes')::date), 'card', 1
    from public.flashcard_reviews where created_at >= %(since)s and user_id = any(%(users)s)
  union all
  select user_id, ((joined_at + interval '330 minutes')::date), 'class', 30
    from public.class_attendance where role = 'student' and joined_at >= %(since)s and user_id = any(%(users)s)
), capped as (
  select *, row_number() over (partition by user_id, d, k order by pts desc) as rn from ev
)
"""
_CAP = "((k = 'checkpoint' and rn <= 10) or (k = 'quiz' and rn <= 10) or (k = 'card' and rn <= 50) or k = 'class')"


def week_start(now: datetime) -> datetime:
    """Monday 00:00 India time, as UTC."""
    local = now + IST
    monday = (local - timedelta(days=local.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return monday - IST


def points(conn: Conn, users: list[str], since: datetime) -> dict[str, int]:
    if not users:
        return {}
    rows = conn.execute(
        _EVENTS + f"select user_id, sum(pts) as pts from capped where {_CAP} group by user_id",  # noqa: S608 - constant SQL
        {"since": since, "users": users},
    ).fetchall()
    return {str(r["user_id"]): int(r["pts"]) for r in rows}


def streak(days: set[Any], today: Any) -> int:
    """Consecutive study days ending today, or yesterday if today hasn't started yet."""
    d = today if today in days else today - timedelta(days=1)
    n = 0
    while d in days:
        n += 1
        d -= timedelta(days=1)
    return n


def mine(conn: Conn, user_id: str, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    since = week_start(now)
    ever = datetime(2000, 1, 1, tzinfo=UTC)
    rows = conn.execute(
        _EVENTS  # noqa: S608 - constant SQL, no user input in the string
        + f"select d, k, count(*) as n, sum(pts) as pts, max(pts) as best from capped where {_CAP} group by d, k",  # noqa: S608
        {"since": ever, "users": [user_id]},
    ).fetchall()
    total = sum(int(r["pts"]) for r in rows)
    week = sum(int(r["pts"]) for r in rows if r["d"] >= (since + IST).date())
    days = {r["d"] for r in rows}
    today = (now + IST).date()
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["k"]] = counts.get(r["k"], 0) + int(r["n"])
    best_quiz = max((int(r["best"]) for r in rows if r["k"] == "quiz"), default=0)
    s = streak(days, today)
    earned = {
        "first_step": counts.get("checkpoint", 0) >= 1,
        "quiz_five": counts.get("quiz", 0) >= 5,
        "sharp": best_quiz >= POINTS["quiz"] + POINTS["quiz_bonus"],
        "live": counts.get("class", 0) >= 1,
        "cards_100": counts.get("card", 0) >= 100,
        "streak_7": s >= 7,
    }
    opted = (
        conn.execute(
            "select 1 from internal.reward_optin where user_id = %s", (user_id,)
        ).fetchone()
        is not None
    )
    return {
        "total": total,
        "week": week,
        "streak": s,
        "studied_today": today in days,
        "badges": [{"id": b, "name": n, "how": h, "earned": earned[b]} for b, n, h in BADGES],
        "on_leaderboard": opted,
        "rules": "10 per checkpoint, 15 per quiz (+10 at 80%), 1 per flashcard, 30 per live class. Daily caps apply.",
    }


def leaderboard(conn: Conn, user_id: str, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    rows = conn.execute(
        "select o.user_id, p.username::text as username from internal.reward_optin o "
        "join public.profiles p on p.id = o.user_id where p.username is not null"
    ).fetchall()
    names = {str(r["user_id"]): str(r["username"]) for r in rows}
    pts = points(conn, list(names), week_start(now))
    ranked = sorted(((pts.get(u, 0), names[u], u) for u in names), key=lambda x: (-x[0], x[1]))
    board = [
        {"rank": i + 1, "username": n, "points": p, "me": u == user_id}
        for i, (p, n, u) in enumerate(ranked[:20])
    ]
    me = next((i + 1 for i, (_, _, u) in enumerate(ranked) if u == user_id), None)
    return {
        "week_start": week_start(now).isoformat(),
        "board": board,
        "my_rank": me,
        "players": len(ranked),
    }


def set_optin(conn: Conn, user_id: str, on: bool) -> None:
    if on:
        conn.execute(
            "insert into internal.reward_optin (user_id) values (%s) on conflict do nothing",
            (user_id,),
        )
    else:
        conn.execute("delete from internal.reward_optin where user_id = %s", (user_id,))
    conn.commit()
