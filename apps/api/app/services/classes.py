"""Live classes (v0.5, ROADMAP.md). Rules decided here, on the server, never in the browser.

- A verified teacher posts a class 30 minutes to 30 days ahead, 30-120 minutes long.
- Students mark Interested before it starts. The queue order is the order they did so.
- The teacher may enter 10 minutes early. At the start, interested students take the first seats
  (up to 40) for a 2-minute grace period; after that any open seat goes to whoever joins first.
- Fewer than 10 interested at the start -> auto-cancelled.
- Teacher not in by 10 minutes after the start -> cancelled, one warning; 3 warnings suspend.
- A class that ran records the teacher's earnings as "to be paid" (no payments in the prototype):
  Rs 2,000 per class minus the 20% platform fee.
- The Jitsi room name lives in internal.class_rooms and is handed out only when someone is seated.

The decision functions are pure (data in, decision out) so every rule is unit-tested exactly; the
state changes they imply are applied lazily whenever a class is read or joined ("settle").
"""

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import psycopg

from app.core.config import get_settings
from app.core.errors import ApiError

Conn = psycopg.Connection[dict[str, Any]]

MIN_STUDENTS, MAX_STUDENTS = 10, 40
TEACHER_EARLY = timedelta(minutes=10)
GRACE = timedelta(minutes=2)
NO_SHOW_AFTER = timedelta(minutes=10)
WARNINGS_TO_SUSPEND = 3
STRIKES_TO_REMOVE = 3  # hidden chat messages in one class before the bot removes you
CLASS_GROSS_PAISE = 200_000  # Rs 2,000
PLATFORM_FEE = 0.20
JITSI = "https://meet.jit.si"

Phase = Literal["upcoming", "teacher_early", "grace", "open", "ended", "cancelled", "done"]


@dataclass(frozen=True)
class Klass:
    id: str
    teacher_id: str
    starts_at: datetime
    duration_min: int
    status: str
    teacher_joined_at: datetime | None = None

    @property
    def ends_at(self) -> datetime:
        return self.starts_at + timedelta(minutes=self.duration_min)


def min_students() -> int:
    return max(
        1, min(get_settings().class_min_students, MIN_STUDENTS)
    )  # a setting can only lower it


def rules() -> dict[str, int]:
    """What the teacher sees before creating a room (TEACHER.md T3: no surprises later)."""
    lead = max(0, get_settings().class_min_lead_min)
    return {
        "min_students": min_students(),
        "max_students": MAX_STUDENTS,
        "min_lead_min": lead,
        "gross_paise": CLASS_GROSS_PAISE,
        "net_paise": CLASS_GROSS_PAISE - round(CLASS_GROSS_PAISE * PLATFORM_FEE),
        "fee_percent": round(PLATFORM_FEE * 100),
    }


# ---- pure rules -------------------------------------------------------------------------------


def phase(c: Klass, now: datetime) -> Phase:
    if c.status in ("cancelled", "done"):
        return c.status  # type: ignore[return-value]
    if now < c.starts_at - TEACHER_EARLY:
        return "upcoming"
    if now < c.starts_at:
        return "teacher_early"
    if now < c.starts_at + GRACE:
        return "grace"
    if now < c.ends_at:
        return "open"
    return "ended"


@dataclass(frozen=True)
class Settlement:
    status: str  # what the class should now be
    reason: str | None = None
    warn_teacher: bool = False
    pay_teacher: bool = False


def settle_decision(c: Klass, interested: int, students_joined: int, now: datetime) -> Settlement:
    """What a scheduled class should become now. Order matters: too few students cancels at the
    start; a missing teacher cancels at +10 min; a class that ran ends as done (and is paid)."""
    if c.status != "scheduled" or now < c.starts_at:
        return Settlement(c.status)
    need = min_students()
    if interested < need and students_joined == 0:
        return Settlement("cancelled", f"Fewer than {need} students were interested.")
    if c.teacher_joined_at is None and now >= c.starts_at + NO_SHOW_AFTER:
        return Settlement("cancelled", "The teacher didn't join.", warn_teacher=True)
    if now >= c.ends_at:
        return Settlement(
            "done", pay_teacher=c.teacher_joined_at is not None and students_joined > 0
        )
    return Settlement("scheduled")


def seat_decision(
    c: Klass, user_id: str, now: datetime, queue: list[str], seated: set[str]
) -> tuple[bool, str]:
    """May this student take a seat now? (allowed, reason if not). `queue` is the interested
    students in signup order; `seated` the students already in."""
    p = phase(c, now)
    if p in ("cancelled", "done", "ended"):
        return False, "This class is over."
    if p in ("upcoming", "teacher_early"):
        return (
            False,
            f"Doors open at {(c.starts_at + timedelta(minutes=330)).strftime('%I:%M %p').lstrip('0')}.",
        )
    if user_id in seated:
        return True, ""  # rejoining after a dropped connection keeps the seat
    if len(seated) >= MAX_STUDENTS:
        return False, f"This class is full ({MAX_STUDENTS} students)."
    if p == "grace":
        reserved = [u for u in queue if u not in seated][: MAX_STUDENTS - len(seated)]
        if user_id not in reserved:
            return (
                False,
                "For the first 2 minutes seats go to students who marked Interested. Try again in a moment.",
            )
    return True, ""


def payout(students: int) -> dict[str, int]:
    fee = round(CLASS_GROSS_PAISE * PLATFORM_FEE)
    return {
        "gross_paise": CLASS_GROSS_PAISE,
        "fee_paise": fee,
        "net_paise": CLASS_GROSS_PAISE - fee,
        "students": students,
    }


# ---- data ----------------------------------------------------------------------------------------

_CLASS_COLS = "c.id, c.teacher_id, c.starts_at, c.duration_min, c.status, c.teacher_joined_at"


def _klass(r: dict[str, Any]) -> Klass:
    return Klass(
        str(r["id"]),
        str(r["teacher_id"]),
        r["starts_at"],
        int(r["duration_min"]),
        str(r["status"]),
        r["teacher_joined_at"],
    )


def _get(conn: Conn, class_id: str) -> Klass:
    sql = f"select {_CLASS_COLS} from public.classes c where c.id = %s"  # noqa: S608 - constant columns
    r = conn.execute(sql, (class_id,)).fetchone()
    if r is None:
        raise ApiError(404, "not_found", "That class doesn't exist.")
    return _klass(r)


def _counts(conn: Conn, class_id: str) -> tuple[list[str], set[str]]:
    queue = [str(r["user_id"]) for r in conn.execute(
        "select user_id from public.class_signups where class_id = %s order by created_at, user_id", (class_id,)
    ).fetchall()]  # fmt: skip
    seated = {str(r["user_id"]) for r in conn.execute(
        "select user_id from public.class_attendance where class_id = %s and role = 'student'", (class_id,)
    ).fetchall()}  # fmt: skip
    return queue, seated


def settle(conn: Conn, c: Klass, now: datetime) -> Klass:
    if c.status != "scheduled" or now < c.starts_at:
        return c
    queue, seated = _counts(conn, c.id)
    d = settle_decision(c, len(queue), len(seated), now)
    if d.status == c.status:
        return c
    conn.execute(
        "update public.classes set status = %s, cancel_reason = %s where id = %s and status = 'scheduled'",
        (d.status, d.reason, c.id),
    )
    if d.warn_teacher:
        warn(conn, c.teacher_id, c.id, "Didn't join their own class.")
    if d.pay_teacher:
        p = payout(len(seated))
        conn.execute(
            "insert into internal.teacher_payouts (class_id, teacher_id, gross_paise, fee_paise, net_paise, students) "
            "values (%s, %s, %s, %s, %s, %s) on conflict (class_id) do nothing",
            (c.id, c.teacher_id, p["gross_paise"], p["fee_paise"], p["net_paise"], p["students"]),
        )
    conn.commit()
    return Klass(c.id, c.teacher_id, c.starts_at, c.duration_min, d.status, c.teacher_joined_at)


def warnings(conn: Conn, user_id: str) -> int:
    n = conn.execute(
        "select count(*) as n from internal.moderation_warnings where user_id = %s", (user_id,)
    ).fetchone()
    return int(n["n"]) if n else 0


def warn(conn: Conn, user_id: str, class_id: str, reason: str) -> None:
    """One account-level warning. A teacher with 3 is suspended; a student with 3 can't join
    classes. The caller commits."""
    conn.execute(
        "insert into internal.moderation_warnings (user_id, class_id, reason) values (%s, %s, %s)",
        (user_id, class_id, reason),
    )
    if warnings(conn, user_id) >= WARNINGS_TO_SUSPEND:
        conn.execute(
            "update public.teachers set status = 'suspended' where user_id = %s", (user_id,)
        )


def removed_from_chat(conn: Conn, user_id: str, class_id: str) -> bool:
    n = conn.execute(
        "select count(*) as n from internal.class_messages "
        "where class_id = %s and user_id = %s and hidden_reason is not null",
        (class_id, user_id),
    ).fetchone()
    return bool(n) and int(n["n"]) >= STRIKES_TO_REMOVE  # type: ignore[index]


def display_name(conn: Conn, user_id: str) -> str:
    t = teacher(conn, user_id)
    if t:
        return str(t["display_name"])
    p = conn.execute(
        "select username::text as username from public.profiles where id = %s", (user_id,)
    ).fetchone()
    return str((p or {}).get("username") or "Student")


def teacher(conn: Conn, user_id: str) -> dict[str, Any] | None:
    r = conn.execute(
        "select user_id, display_name, bio, subjects, status, qualification, experience_years, languages, "
        "preferred_days, preferred_slots, levels, organisation, review_note, "
        "document_path is not null as has_document from public.teachers where user_id = %s",
        (user_id,),
    ).fetchone()
    return dict(r) if r else None


PROFILE_FIELDS = (
    "display_name", "bio", "subjects", "organisation", "qualification", "experience_years", "languages",
    "preferred_days", "preferred_slots", "levels",
)  # fmt: skip


def apply(conn: Conn, user_id: str, profile: dict[str, Any]) -> dict[str, Any]:
    """Create or edit the teacher profile (the sign-up questionnaire). Never touches status."""
    cols = ", ".join(PROFILE_FIELDS)
    vals = ", ".join(["%s"] * len(PROFILE_FIELDS))
    sets = ", ".join(f"{c} = excluded.{c}" for c in PROFILE_FIELDS)
    conn.execute(
        f"insert into public.teachers (user_id, {cols}, consent_at, submitted_at) values (%s, {vals}, now(), now()) "  # noqa: S608 - constant columns
        f"on conflict (user_id) do update set {sets}, submitted_at = now(), "
        "status = case when public.teachers.status = 'rejected' then 'pending' else public.teachers.status end",
        (user_id, *(profile[c] for c in PROFILE_FIELDS)),
    )
    if get_settings().teacher_auto_verify:
        conn.execute(
            "update public.teachers set status = 'verified', verified_at = coalesce(verified_at, now()) "
            "where user_id = %s and status = 'pending'",
            (user_id,),
        )
    conn.commit()
    t = teacher(conn, user_id)
    assert t is not None
    return t


def create(
    conn: Conn, user_id: str, subject: str, topic: str, level: str, starts_at: datetime, duration_min: int,
    now: datetime | None = None,
) -> str:  # fmt: skip
    now = now or datetime.now(UTC)
    t = teacher(conn, user_id)
    if not t or t["status"] != "verified":
        raise ApiError(
            403,
            "forbidden",
            "Only verified teachers can post classes. Your application is being reviewed.",
        )
    lead = get_settings().class_min_lead_min
    if (
        not now + timedelta(minutes=lead) - timedelta(seconds=90)
        <= starts_at
        <= now + timedelta(days=30)
    ):
        raise ApiError(
            422,
            "invalid_input",
            f"Schedule the room between {lead} minutes and 30 days from now."
            if lead
            else "Schedule the room within the next 30 days.",
        )
    row = conn.execute(
        "insert into public.classes (teacher_id, subject, topic, level, starts_at, duration_min) "
        "values (%s, %s, %s, %s, %s, %s) returning id",
        (user_id, subject, topic, level, starts_at, duration_min),
    ).fetchone()
    assert row is not None
    conn.execute(
        "insert into internal.class_rooms (class_id, room) values (%s, %s)",
        (row["id"], f"vl-{secrets.token_hex(16)}"),
    )
    conn.commit()
    return str(row["id"])


def cancel(conn: Conn, user_id: str, class_id: str, now: datetime | None = None) -> None:
    now = now or datetime.now(UTC)
    c = _get(conn, class_id)
    if c.teacher_id != user_id:
        raise ApiError(404, "not_found", "That class doesn't exist.")
    if c.status != "scheduled" or now >= c.starts_at:
        raise ApiError(409, "too_late", "A class can only be cancelled before it starts.")
    conn.execute(
        "update public.classes set status = 'cancelled', cancel_reason = 'Cancelled by the teacher.' where id = %s",
        (class_id,),
    )
    conn.commit()


def interest(
    conn: Conn, user_id: str, class_id: str, on: bool, now: datetime | None = None
) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    c = _get(conn, class_id)
    if c.teacher_id == user_id:
        raise ApiError(422, "invalid_input", "You're teaching this class.")
    if c.status != "scheduled" or now >= c.starts_at:
        raise ApiError(409, "too_late", "Interest closes when the class starts.")
    if on:
        conn.execute(
            "insert into public.class_signups (class_id, user_id) values (%s, %s) on conflict do nothing",
            (class_id, user_id),
        )
    else:
        conn.execute(
            "delete from public.class_signups where class_id = %s and user_id = %s",
            (class_id, user_id),
        )
    conn.commit()
    queue, _ = _counts(conn, class_id)
    return {
        "interested": len(queue),
        "mine": user_id in queue,
        "position": queue.index(user_id) + 1 if user_id in queue else None,
    }


def join(
    conn: Conn, user_id: str, class_id: str, display_name: str, now: datetime | None = None
) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    c = settle(conn, _get(conn, class_id), now)
    if c.status == "cancelled":
        r = conn.execute(
            "select cancel_reason from public.classes where id = %s", (class_id,)
        ).fetchone()
        raise ApiError(
            409,
            "cancelled",
            f"This class was cancelled. {(r or {}).get('cancel_reason') or ''}".strip(),
        )
    if removed_from_chat(conn, user_id, class_id):
        raise ApiError(
            403,
            "removed",
            "The moderation bot removed you from this class for breaking the chat rules.",
        )
    if c.teacher_id == user_id:
        if not c.starts_at - TEACHER_EARLY <= now < c.ends_at:
            raise ApiError(409, "not_open", "You can open the room 10 minutes before the start.")
        role = "teacher"
        conn.execute(
            "update public.classes set teacher_joined_at = coalesce(teacher_joined_at, now()) where id = %s",
            (class_id,),
        )
    else:
        if warnings(conn, user_id) >= WARNINGS_TO_SUSPEND:
            raise ApiError(403, "blocked", "Your account can't join live classes after 3 warnings.")
        queue, seated = _counts(conn, class_id)
        ok, why = seat_decision(c, user_id, now, queue, seated)
        if not ok:
            raise ApiError(409, "no_seat", why)
        role = "student"
    conn.execute(
        "insert into public.class_attendance (class_id, user_id, role) values (%s, %s, %s) on conflict do nothing",
        (class_id, user_id, role),
    )
    room = conn.execute(
        "select room from internal.class_rooms where class_id = %s", (class_id,)
    ).fetchone()
    conn.commit()
    if room is None:
        raise ApiError(500, "internal", "This class has no room. Ask the teacher to post it again.")
    return {
        "room_url": f"{JITSI}/{room['room']}",
        "room": room["room"],
        "role": role,
        "display_name": display_name,
        "ends_at": c.ends_at.isoformat(),
    }


def listing(conn: Conn, user_id: str, now: datetime | None = None) -> list[dict[str, Any]]:
    """Classes from 3 hours ago to 30 days ahead, settled, with my interest and seat status."""
    now = now or datetime.now(UTC)
    rows = conn.execute(
        f"select {_CLASS_COLS}, c.subject, c.topic, c.level, c.cancel_reason, t.display_name as teacher_name "  # noqa: S608
        "from public.classes c join public.teachers t on t.user_id = c.teacher_id "
        "where c.starts_at > %s and c.starts_at < %s order by c.starts_at limit 100",
        (now - timedelta(hours=3), now + timedelta(days=30)),
    ).fetchall()
    my_ratings = {
        str(x["class_id"]): int(x["stars"])
        for x in conn.execute(
            "select class_id, stars from internal.class_ratings where user_id = %s", (user_id,)
        ).fetchall()
    }
    out = []
    for r in rows:
        c = settle(conn, _klass(r), now)
        reason = r["cancel_reason"]
        if c.status == "cancelled" and r["status"] != "cancelled":  # cancelled just now by settle
            got = conn.execute(
                "select cancel_reason from public.classes where id = %s", (c.id,)
            ).fetchone()
            reason = got["cancel_reason"] if got else None
        queue, seated = _counts(conn, c.id)
        out.append(
            {
                "id": c.id,
                "subject": r["subject"],
                "topic": r["topic"],
                "level": r["level"],
                "teacher": r["teacher_name"],
                "mine_teaching": c.teacher_id == user_id,
                "starts_at": c.starts_at.isoformat(),
                "ends_at": c.ends_at.isoformat(),
                "duration_min": c.duration_min,
                "phase": phase(c, now),
                "cancel_reason": reason if c.status == "cancelled" else None,
                "interested": len(queue),
                "min_students": min_students(),
                "max_students": MAX_STUDENTS,
                "mine_interested": user_id in queue,
                "position": queue.index(user_id) + 1 if user_id in queue else None,
                "seated": user_id in seated,
                "my_rating": my_ratings.get(c.id),
            }
        )
    return out


def earnings(conn: Conn, user_id: str) -> dict[str, Any]:
    rows = conn.execute(
        "select p.class_id, p.net_paise, p.fee_paise, p.gross_paise, p.students, p.status, c.topic, c.starts_at "
        "from internal.teacher_payouts p join public.classes c on c.id = p.class_id "
        "where p.teacher_id = %s order by c.starts_at desc",
        (user_id,),
    ).fetchall()

    def total(status: str) -> int:
        return sum(int(r["net_paise"]) for r in rows if r["status"] == status)

    return {
        "classes": [
            dict(r, starts_at=r["starts_at"].isoformat(), class_id=str(r["class_id"])) for r in rows
        ],
        "to_be_paid_paise": total("to_be_paid"),
        "requested_paise": total("requested"),
        "paid_paise": total("paid"),
        "warnings": warnings(conn, user_id),
        "warnings_to_suspend": WARNINGS_TO_SUSPEND,
    }


def stats(conn: Conn, user_id: str, now: datetime | None = None) -> dict[str, Any]:
    """The teacher dashboard numbers, all from Supabase."""
    now = now or datetime.now(UTC)
    r = conn.execute(
        "select "
        " count(*) filter (where c.status = 'done') as done,"
        " count(*) filter (where c.status = 'scheduled' and c.starts_at > %s) as upcoming,"
        " count(*) filter (where c.status = 'cancelled') as cancelled,"
        " (select count(*) from public.class_attendance a join public.classes x on x.id = a.class_id"
        "   where x.teacher_id = %s and a.role = 'student') as students,"
        " (select count(*) from public.class_signups s join public.classes x on x.id = s.class_id"
        "   where x.teacher_id = %s) as interested,"
        " (select round(avg(g.stars)::numeric, 1) from internal.class_ratings g join public.classes x on x.id = g.class_id"
        "   where x.teacher_id = %s) as rating,"
        " (select count(*) from internal.class_ratings g join public.classes x on x.id = g.class_id"
        "   where x.teacher_id = %s) as ratings"
        " from public.classes c where c.teacher_id = %s",
        (now, user_id, user_id, user_id, user_id, user_id),
    ).fetchone()
    top = conn.execute(
        "select subject, count(*) as n from public.classes where teacher_id = %s and status <> 'cancelled' "
        "group by subject order by n desc, subject limit 1",
        (user_id,),
    ).fetchone()
    r = r or {}
    done = int(r.get("done") or 0)
    return {
        "classes_done": done,
        "upcoming": int(r.get("upcoming") or 0),
        "cancelled": int(r.get("cancelled") or 0),
        "students_taught": int(r.get("students") or 0),
        "avg_students": round(int(r.get("students") or 0) / done, 1) if done else 0,
        "interested_total": int(r.get("interested") or 0),
        "rating": float(r["rating"]) if r.get("rating") is not None else None,
        "ratings": int(r.get("ratings") or 0),
        "focused_subject": top["subject"] if top else None,
    }


def withdraw(conn: Conn, user_id: str) -> dict[str, Any]:
    """No payments in the prototype: a withdrawal is a request the team pays out by hand."""
    t = teacher(conn, user_id)
    if not t:
        raise ApiError(404, "not_found", "Set up your teacher profile first.")
    n = conn.execute(
        "update internal.teacher_payouts set status = 'requested', requested_at = now() "
        "where teacher_id = %s and status = 'to_be_paid'",
        (user_id,),
    ).rowcount
    if not n:
        raise ApiError(
            409,
            "nothing_to_withdraw",
            "There's nothing to withdraw yet. Earnings appear after each class you teach.",
        )
    conn.commit()
    return earnings(conn, user_id)


def rate(
    conn: Conn, user_id: str, class_id: str, stars: int, now: datetime | None = None
) -> dict[str, Any]:
    """Students who sat in a class rate it once it has ended (changing it later is fine)."""
    now = now or datetime.now(UTC)
    c = settle(conn, _get(conn, class_id), now)
    seated = conn.execute(
        "select 1 from public.class_attendance where class_id = %s and user_id = %s and role = 'student'",
        (class_id, user_id),
    ).fetchone()
    if not seated:
        raise ApiError(403, "forbidden", "Only students who joined this class can rate it.")
    if phase(c, now) not in ("ended", "done"):
        raise ApiError(409, "too_early", "You can rate the class once it has ended.")
    conn.execute(
        "insert into internal.class_ratings (class_id, user_id, stars) values (%s, %s, %s) "
        "on conflict (class_id, user_id) do update set stars = excluded.stars",
        (class_id, user_id, stars),
    )
    conn.commit()
    return {"stars": stars}
