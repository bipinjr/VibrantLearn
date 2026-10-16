"""An in-memory stand-in for the handful of tables the message pipeline touches, with real
commit/rollback semantics, so "no half-written rows" can be asserted without a database.

Statements are matched by a normalised prefix; an unknown statement fails the test loudly.
"""

import copy
import re
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from psycopg.types.json import Jsonb


def _v(x: Any) -> Any:
    return x.obj if isinstance(x, Jsonb) else x


class _Result:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def fetchone(self) -> dict[str, Any] | None:
        return self.rows[0] if self.rows else None

    def fetchall(self) -> list[dict[str, Any]]:
        return self.rows


class FakeDb:
    def __init__(self, syllabus: dict[str, list[dict[str, Any]]]) -> None:
        self.state: dict[str, Any] = {
            "sessions": {},  # id -> {user_id, subject, title, deadline_at, mode}
            "profiles": {},  # id -> {language}
            "messages": [],  # dicts, insertion order = created_at order
            "plans": [],
            "files": [],
            "usage": [],
            "llm_cache": {},
            "rate": {},
        }
        self.syllabus = syllabus
        self._saved = copy.deepcopy(self.state)
        self.commits = 0

    # ---- transaction -------------------------------------------------------------------------
    def commit(self) -> None:
        self._saved = copy.deepcopy(self.state)
        self.commits += 1

    def rollback(self) -> None:
        self.state = copy.deepcopy(self._saved)

    @contextmanager
    def connect(self) -> Iterator["FakeDb"]:
        try:
            yield self
        except BaseException:
            self.rollback()
            raise
        else:
            self.commit()

    # ---- statements --------------------------------------------------------------------------
    def execute(self, sql: str, p: Any = None) -> _Result:
        q = re.sub(r"\s+", " ", sql).strip().lower()
        st = self.state
        if q.startswith("insert into internal.rate_limits"):
            k = (p["s"], p["b"])
            st["rate"][k] = st["rate"].get(k, 0) + 1
            return _Result([{"count": st["rate"][k], "retry": 60}])
        if q.startswith("select 1 from public.study_sessions where id = %s and user_id = %s"):
            s = st["sessions"].get(p[0])
            return _Result([{"x": 1}] if s and s["user_id"] == p[1] else [])
        if q.startswith(
            "insert into public.messages (id, session_id, user_id, role, content) values"
        ):
            if not any(m["id"] == p[0] for m in st["messages"]):
                st["messages"].append(
                    {
                        "id": p[0],
                        "session_id": p[1],
                        "user_id": p[2],
                        "role": "user",
                        "content": p[3],
                        "blocks": [],
                    }
                )
            return _Result([])
        if q.startswith(
            "insert into public.messages (id, session_id, user_id, role, content, blocks"
        ):
            st["messages"].append(
                {
                    "id": p[0], "session_id": p[1], "user_id": p[2], "role": "assistant", "content": "",
                    "blocks": _v(p[3]), "intent": p[4], "served_from": p[5],
                }
            )  # fmt: skip
            return _Result([])
        if q.startswith("select subject from public.study_sessions"):
            s = st["sessions"].get(p[0])
            return _Result([{"subject": s["subject"]}] if s and s["user_id"] == p[1] else [])
        if q.startswith("select language from public.profiles"):
            pr = st["profiles"].get(p[0])
            return _Result([pr] if pr else [])
        if q.startswith("select blocks from public.messages"):
            rows = [
                m
                for m in st["messages"]
                if m["session_id"] == p[0] and m["user_id"] == p[1] and m["role"] == "assistant"
            ]
            return _Result([{"blocks": rows[-1]["blocks"]}] if rows else [])
        if q.startswith("select role, content, blocks from public.messages"):
            rows = [m for m in st["messages"] if m["session_id"] == p[0] and m["user_id"] == p[1]]
            return _Result(list(reversed(rows))[:7])
        if q.startswith("select display_name as name, status from public.files"):
            return _Result(
                [
                    {"name": f["name"], "status": f["status"]}
                    for f in st["files"]
                    if f["session_id"] == p[0]
                ]
            )
        if q.startswith("select s.subject, t.unit"):
            return _Result(
                [
                    {
                        "subject": subj, "unit": t["unit"], "unit_title": t["unitTitle"], "topic": t["topic"],
                        "weightage": t["weightage"], "difficulty": t["difficulty"],
                        "est_minutes": t["minutes"], "subtopics": t["subtopics"],
                    }
                    for subj, ts in self.syllabus.items()
                    for t in ts
                ]
            )  # fmt: skip
        if q.startswith("delete from public.study_plans where session_id"):
            st["plans"] = [
                x for x in st["plans"] if not (x["session_id"] == p[0] and x["user_id"] == p[1])
            ]
            return _Result([])
        if q.startswith("insert into public.study_plans"):
            st["plans"].append(
                {"id": p[0], "session_id": p[1], "user_id": p[2], "subject": p[3], "plan": _v(p[8])}
            )
            return _Result([])
        if q.startswith("update public.study_sessions set title"):
            s = st["sessions"].get(p[4])
            if s and s["user_id"] == p[5]:
                s.update(title=p[0], subject=p[1], deadline_at=p[2], mode=p[3])
            return _Result([])
        if q.startswith("update public.study_sessions set updated_at"):
            return _Result([])
        if q.startswith("insert into internal.usage_events"):
            st["usage"].append({"user_id": p[0], "kind": p[1], "served_from": p[2]})
            return _Result([])
        if q.startswith("update internal.llm_cache set hits"):
            hit = st["llm_cache"].get(p[0])
            return _Result([{"response": hit}] if hit is not None else [])
        if q.startswith("insert into internal.llm_cache"):
            st["llm_cache"][p[0]] = _v(p[4])
            return _Result([])
        raise AssertionError(f"FakeDb: unexpected SQL: {q[:90]}")
