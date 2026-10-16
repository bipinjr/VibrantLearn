"""An in-memory stand-in for the handful of tables the message pipeline touches, with real
commit/rollback semantics, so "no half-written rows" can be asserted without a database.

Statements are matched by a normalised prefix; an unknown statement fails the test loudly.
"""

import copy
import re
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
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
            "audit": [],
            "chunks": [],
            "content": {},
            "quiz_keys": {},
            "attempts": [],
        }
        self.syllabus = syllabus
        self.now = datetime.now(UTC)
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

    def cursor(self) -> "FakeDb":
        return self

    def __enter__(self) -> "FakeDb":
        return self

    def __exit__(self, *exc: object) -> None:
        pass

    def executemany(self, sql: str, rows: list[Any]) -> None:
        assert sql.lower().startswith("insert into public.file_chunks"), sql
        for r in rows:
            self.state["chunks"].append(
                dict(
                    zip(
                        ("file_id", "session_id", "user_id", "idx", "content", "page"),
                        r,
                        strict=True,
                    )
                )
            )

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
        if q.startswith("select id, display_name as name, status from public.files"):
            return _Result(
                [
                    {"id": f["id"], "name": f["name"], "status": f["status"]}
                    for f in st["files"]
                    if f["session_id"] == p[0] and f["user_id"] == p[1]
                ]
            )
        if q.startswith("select c.file_id, f.display_name as file_name, c.page, c.content"):
            ready = {f["id"]: f for f in st["files"] if f["status"] == "ready"}
            if "c.idx" in q:  # first_chunks(user, file, limit)
                rows = [c for c in st["chunks"] if c["user_id"] == p[0] and c["file_id"] == p[1]][
                    : p[2]
                ]
            else:  # search(user, session, ids, ids, terms, terms): any term, like the OR tsquery
                terms = p[4].split(" | ")
                rows = [
                    c for c in st["chunks"]
                    if c["user_id"] == p[0] and c["session_id"] == p[1] and c["file_id"] in ready
                    and (p[2] is None or c["file_id"] in p[2])
                    and any(t in c["content"].lower() for t in terms)
                ][:30]  # fmt: skip
            return _Result(
                [
                    {"file_id": c["file_id"], "file_name": ready.get(c["file_id"], {}).get("name", "?"),
                     "page": c["page"], "content": c["content"]}
                    for c in rows
                ]
            )  # fmt: skip
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
        if q.startswith(
            "select count(*) as n, coalesce(sum(size_bytes), 0) as bytes from public.files"
        ):
            mine = [f for f in st["files"] if f["user_id"] == p[0] and f["created_at"] >= p[1]]
            return _Result([{"n": len(mine), "bytes": sum(f["size_bytes"] for f in mine)}])
        if q.startswith("insert into public.files"):
            st["files"].append(
                {
                    "id": p[0], "session_id": p[1], "user_id": p[2], "storage_path": p[3], "original_name": p[4],
                    "name": p[5], "mime": p[6], "size_bytes": p[7], "status": "uploaded", "created_at": self.now,
                }
            )  # fmt: skip
            return _Result([])
        if q.startswith("insert into internal.audit_log"):
            st["audit"].append({"action": p[1], "user_id": p[0], "meta": _v(p[3])})
            return _Result([])
        if q.startswith(
            "select id, session_id, storage_path, display_name, size_bytes, status, pages, error from public.files"
        ):
            f = next((f for f in st["files"] if f["id"] == p[0] and f["user_id"] == p[1]), None)
            if not f:
                return _Result([])
            return _Result(
                [
                    {
                        "display_name": f["name"],
                        **{
                            k: f.get(k)
                            for k in (
                                "id",
                                "session_id",
                                "storage_path",
                                "size_bytes",
                                "status",
                                "pages",
                                "error",
                            )
                        },
                    }
                ]
            )
        if q.startswith("update public.files set status = %s, updated_at = now()"):
            cols = re.findall(r", (\w+) = %s", q)
            f = next(f for f in st["files"] if f["id"] == p[-1])
            f["status"] = p[0]
            f.update(dict(zip(cols, p[1:-1], strict=True)))
            return _Result([])
        if q.startswith(
            "select id from public.files where session_id = %s and user_id = %s and sha256 = %s"
        ):
            hit = [
                f
                for f in st["files"]
                if f["session_id"] == p[0]
                and f["user_id"] == p[1]
                and f.get("sha256") == p[2]
                and f["status"] == "ready"
                and f["id"] != p[3]
            ]
            return _Result([{"id": hit[0]["id"]}] if hit else [])
        if q.startswith("delete from public.files where id = %s and user_id = %s"):
            st["files"] = [f for f in st["files"] if not (f["id"] == p[0] and f["user_id"] == p[1])]
            st["chunks"] = [c for c in st["chunks"] if c["file_id"] != p[0]]
            return _Result([])
        if q.startswith("insert into public.generated_content"):
            cid = str(uuid.uuid4())
            st["content"][cid] = {
                "user_id": p[0],
                "session_id": p[1],
                "topic": p[2],
                "payload": _v(p[4]),
            }
            return _Result([{"id": cid}])
        if q.startswith("insert into internal.quiz_keys"):
            st["quiz_keys"][p[0]] = {"answers": p[1], "why": p[2], "topics": p[3]}
            return _Result([])
        if q.startswith("select k.answers, k.why, k.topics from internal.quiz_keys"):
            k, c = st["quiz_keys"].get(p[0]), st["content"].get(p[0])
            return _Result([k] if k and c and c["user_id"] == p[1] else [])
        if q.startswith("select id, answers from public.quiz_attempts"):
            rows = [a for a in st["attempts"] if a["content_id"] == p[0] and a["user_id"] == p[1]]
            return _Result([rows[-1]] if rows else [])
        if q.startswith("insert into public.quiz_attempts"):
            row = {
                "id": f"att-{len(st['attempts']) + 1}",
                "user_id": p[0],
                "content_id": p[1],
                "answers": {},
                "score": 0,
                "total": p[2],
            }
            st["attempts"].append(row)
            return _Result([{"id": row["id"], "answers": {}}])
        if q.startswith("update public.quiz_attempts set answers"):
            row = next(a for a in st["attempts"] if a["id"] == p[2] and a["user_id"] == p[3])
            row["answers"], row["score"] = dict(_v(p[0])), p[1]
            return _Result([])
        if q.startswith("select count, window_start + make_interval"):
            n = st["rate"].get((p["s"], p["b"]))
            return _Result([{"count": n, "resets_at": self.now}] if n else [])
        if q.startswith("select username::text"):
            pr = st["profiles"].get(p[0])
            return _Result([{"username": pr.get("username", "user"), **pr}] if pr else [])
        if m := re.match(r"select .+ from public\.(\w+) where user_id = %s", q):
            rows = st["sessions"] if m.group(1) == "study_sessions" else st.get(m.group(1), [])
            vals = rows.values() if isinstance(rows, dict) else rows
            return _Result([dict(r) for r in vals if r.get("user_id") == p[0]])
        raise AssertionError(f"FakeDb: unexpected SQL: {q[:90]}")
