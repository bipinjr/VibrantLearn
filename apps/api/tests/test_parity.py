"""E3/E4: the Python intake and scheduler reproduce the TypeScript ones exactly.

Fixture: tests/fixtures/parity.json, written by apps/web/lib/demo/parity.dump.test.ts.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

from app.ml.parse import parse_request
from app.ml.scheduler import Topic, build_plan

FIX: dict[str, Any] = json.loads(
    (Path(__file__).parent / "fixtures/parity.json").read_text("utf-8")
)


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def topics(subject: str) -> list[Topic]:
    return [
        Topic(
            subject=t["subject"], unit=t["unit"], unit_title=t["unitTitle"], topic=t["topic"],
            weightage=t["weightage"], difficulty=t["difficulty"], minutes=t["minutes"],
            subtopics=tuple(t["subtopics"]),
        )
        for t in FIX["syllabus"][subject]
    ]  # fmt: skip


@pytest.mark.parametrize(
    "case", FIX["plans"], ids=lambda c: f"{c['mode']}-{c['subject'][:6]}-{c['now'][11:16]}"
)
def test_scheduler_matches_typescript(case: dict[str, Any]) -> None:
    steps = build_plan(
        topics(case["subject"]),
        case["subject"],
        _dt(case["deadline"]),
        _dt(case["now"]),
        case["mode"],
        "p",
        case.get("hours"),
        case.get("weak") or (),
    )
    assert steps == case["steps"]


@pytest.mark.parametrize("case", FIX["parses"], ids=lambda c: c["text"][:30])
def test_parser_matches_typescript(case: dict[str, Any]) -> None:
    p = parse_request(case["text"], _dt(case["now"]))
    got = {
        "intent": p.intent,
        "subject": p.subject,
        "deadline": p.deadline.isoformat().replace("+00:00", "Z") if p.deadline else None,
        "hours": p.hours,
        "language": p.language,
        "mode": p.mode,
        "weak": p.weak,
    }
    want = {k: case[k] for k in got}
    if want["deadline"]:
        want["deadline"] = want["deadline"].replace(".000Z", "Z")
    assert got == want


def test_late_night_crash_plan_still_teaches() -> None:
    """The A0 regression, stated directly: 10:40 PM, exam at 10 AM -> real syllabus topics."""
    t = topics("Database Management Systems")
    steps = build_plan(
        t,
        "Database Management Systems",
        _dt("2026-10-09T04:30:00Z"),
        _dt("2026-10-08T17:10:00Z"),
        "crash",
        "p",
        2,
    )
    names = {x.topic for x in t}
    assert any(s["kind"] == "block" and s["title"] in names for s in steps)
    assert steps[-2]["title"] == "15-minute mock test"
