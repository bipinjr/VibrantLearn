"""Syllabus topics from public.syllabus_topics: the data the scheduler and content run on.

Subjects are rows, not code (ARCHITECTURE.md §4). The newest version of each subject wins.
Cached in memory for 10 minutes per warm instance; the syllabus changes only through migrations.
"""

import time
from typing import Any

import psycopg

from app.ml.scheduler import Topic

_TTL_S = 600
_cache: tuple[float, dict[str, list[Topic]]] | None = None

_SQL = """
select s.subject, t.unit, t.unit_title, t.topic, t.weightage, t.difficulty, t.est_minutes,
       t.subtopics
from public.syllabus_topics t
join public.syllabi s on s.id = t.syllabus_id
where s.version = (select max(s2.version) from public.syllabi s2 where s2.subject = s.subject)
order by s.subject, t.unit, t.ord
"""


def load(conn: psycopg.Connection[dict[str, Any]]) -> dict[str, list[Topic]]:
    global _cache
    if _cache and time.monotonic() - _cache[0] < _TTL_S:
        return _cache[1]
    out: dict[str, list[Topic]] = {}
    for r in conn.execute(_SQL).fetchall():
        out.setdefault(str(r["subject"]), []).append(
            Topic(
                subject=str(r["subject"]),
                unit=int(r["unit"]),
                unit_title=str(r["unit_title"]),
                topic=str(r["topic"]),
                weightage=int(r["weightage"]),
                difficulty=int(r["difficulty"]),
                minutes=int(r["est_minutes"]),
                subtopics=tuple(r["subtopics"] or ()),
            )
        )
    _cache = (time.monotonic(), out)
    return out


def clear() -> None:
    global _cache
    _cache = None
