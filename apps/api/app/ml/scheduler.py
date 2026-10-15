"""Deterministic study-plan scheduler (PRD F6). No LLM; a plan never runs past the exam.

Port of apps/web/lib/demo/scheduler.ts, checked step-for-step against it by
tests/test_parity.py (22 shared cases, including the 10:40 PM crash-plan regression).
Topics are data (public.syllabus_topics); nothing here names a subject.
Times are epoch milliseconds internally so rounding matches the JavaScript Date maths exactly.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal, TypedDict

from app.ml.parse import Mode, ist_at

MIN = 60_000
DAY = 86_400_000
StepKind = Literal["block", "checkpoint", "exam"]


@dataclass(frozen=True)
class Topic:
    subject: str
    unit: int
    unit_title: str
    topic: str
    weightage: int
    difficulty: int
    minutes: int
    subtopics: tuple[str, ...]


class Step(TypedDict, total=False):
    id: str
    kind: StepKind
    title: str
    unit: str
    start: str
    end: str
    minutes: int
    done: bool


def _ms(d: datetime) -> int:
    return round(d.timestamp() * 1000)


def _iso(ms: int) -> str:
    """Same text as JavaScript's Date.toISOString(): 2026-10-09T04:30:00.000Z."""
    d = datetime.fromtimestamp(ms / 1000, UTC)
    return d.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms % 1000:03d}Z"


def _ist(base_ms: int, day_offset: int, h: int, m: int = 0) -> int:
    return _ms(ist_at(datetime.fromtimestamp(base_ms / 1000, UTC), day_offset, h, m))


def _round_up5(ms: int) -> int:
    return math.ceil(ms / (5 * MIN)) * 5 * MIN


def priority(topics: Sequence[Topic], weak: Sequence[str] = ()) -> list[Topic]:
    """Weak topics first, then highest exam weight; easier first among equals."""

    def is_weak(t: Topic) -> bool:
        hay = f"{t.unit_title} {t.topic} {' '.join(t.subtopics)}".lower()
        return any(w[: max(4, len(w) - 2)] in hay for w in weak)

    return sorted(topics, key=lambda t: (-int(is_weak(t)), -t.weightage, t.difficulty))


def build_plan(
    topics: Sequence[Topic],
    subject: str,
    deadline: datetime,
    now: datetime,
    mode: Mode,
    id_prefix: str,
    hours_per_day: float | None = None,
    weak: Sequence[str] = (),
) -> list[Step]:
    dl, nw = _ms(deadline), _ms(now)
    ordered = priority(topics, weak)
    steps: list[Step] = []
    counter = 0

    def add(kind: StepKind, title: str, start: int, minutes: int, unit: str | None = None) -> int:
        nonlocal counter
        step: Step = {"id": f"{id_prefix}-{counter}", "kind": kind, "title": title}
        counter += 1
        if unit:
            step["unit"] = unit
        step["start"] = _iso(start)
        if minutes:
            step["end"] = _iso(start + minutes * MIN)
            step["minutes"] = minutes
        step["done"] = False
        steps.append(step)
        return start + minutes * MIN

    def exam() -> None:
        title = f"{subject.replace(' Programming', '')} exam"
        steps.append(
            {
                "id": f"{id_prefix}-exam",
                "kind": "exam",
                "title": title,
                "start": _iso(dl),
                "done": False,
            }
        )

    if mode == "sprint":
        # 25/5 focus blocks on top topics only, ending with a 15-minute mock quiz before the exam.
        t = _round_up5(nw)
        last_start = dl - 15 * MIN
        for tp in ordered:
            if t + 25 * MIN > last_start:
                break
            t = add("block", tp.topic, t, 25, f"Unit {tp.unit}") + 5 * MIN
        if t + 15 * MIN <= dl:
            add("checkpoint", "15-minute mock quiz", t, 15)
        exam()
        return steps

    if mode == "crash":
        budget = (hours_per_day if hours_per_day is not None else 3) * 60
        days = max(0, round((_ist(dl, 0, 0) - _ist(nw, 0, 0)) / DAY))
        queue = list(ordered)
        for d in range(max(days, 1)):
            t = _round_up5(nw) if d == 0 else _ist(nw, d, 18, 0)
            sleep = _ist(nw, d, 23, 0)
            used = 0.0
            if d == days - 1 and d > 0:
                t = add("block", "Revise everything you marked weak", t, 40) + 5 * MIN
                used += 45
            k = 0
            while k < len(queue):  # first fit, highest priority first
                tp = queue[k]
                fits = used + tp.minutes + 15 <= budget and t + tp.minutes * MIN <= min(sleep, dl)
                if not fits:
                    k += 1
                    continue
                queue.pop(k)
                t = add("block", tp.topic, t, tp.minutes, f"Unit {tp.unit}") + 5 * MIN
                used += tp.minutes + 5
            if steps and t + 10 * MIN <= min(sleep + 30 * MIN, dl):
                title = (
                    "10-question quiz on tonight's topics" if d == 0 else "Quiz on today's topics"
                )
                add("checkpoint", title, t, 10)
        # Exam-day morning: topics the evenings couldn't reach come first (a student who opens
        # the app at 10:40 PM has no usable evening left), then the revision extras.
        morning = _ist(dl, 0, 6, 30)
        morning_end = dl - 30 * MIN  # walk-to-the-hall buffer
        if days >= 1 and morning_end - morning >= 45 * MIN:
            t = morning
            used = 0.0
            study_end = morning_end - 20 * MIN  # keep room for the closing mock test

            def room(minutes: int) -> bool:
                return used + minutes <= budget and t + minutes * MIN <= study_end

            k = 0
            while k < len(queue):
                tp = queue[k]
                if not room(tp.minutes):
                    k += 1
                    continue
                queue.pop(k)
                t = add("block", tp.topic, t, tp.minutes, f"Unit {tp.unit}") + 5 * MIN
                used += tp.minutes + 5
            if any(s["kind"] == "checkpoint" for s in steps) and room(30):
                t = add("block", "Redo the questions you got wrong", t, 30) + 5 * MIN
                used += 35
            if t + 15 * MIN <= morning_end:
                add("checkpoint", "15-minute mock test", t, 15)
        exam()
        return steps

    # steady / deep: one unit per week, weekend checkpoints, the final stretch for spaced revision.
    units: dict[int, str] = {}
    for tp in topics:
        units.setdefault(tp.unit, tp.unit_title)
    unit_list = list(units.items())
    weeks = max(1, (dl - nw) // (7 * DAY))
    study_weeks = max(1, weeks - 1)
    per_week = math.ceil(len(unit_list) / study_weeks)
    for w in range(study_weeks):
        chunk = unit_list[w * per_week : (w + 1) * per_week]
        if not chunk:
            break
        start = _ist(nw, 1 + w * 7, 17, 0)
        if start >= dl:
            break
        unit_ids = {u for u, _ in chunk}
        mins = sum(tp.minutes for tp in topics if tp.unit in unit_ids)
        add("block", f"Week {w + 1}: {', '.join(title for _, title in chunk)}", start, mins)
        sat = _ist(nw, 1 + w * 7 + 4, 11, 0)
        if sat < dl:
            add("checkpoint", f"Weekend checkpoint: 20 questions on week {w + 1}", sat, 40)
    rev_start = _ist(dl, -6, 17, 0)
    if rev_start > nw:
        for i, gap in enumerate((1, 3, 7)):
            at = rev_start + round((gap - 1) * DAY * 0.8)
            if at < dl:
                add("block", f"Revision loop {i + 1}: weakest topics first", at, 60)
    exam()
    return sorted(steps, key=lambda s: s["start"])
