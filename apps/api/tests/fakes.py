"""In-memory stand-ins so endpoint logic is tested without a database or Storage.

FakeConn understands only the handful of statements the services issue, matched by a stable
prefix; anything else fails loudly so a new query can't silently pass a test.
"""

import re
from dataclasses import dataclass, field
from typing import Any

from app.core.errors import ApiError


class FakeStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.signed: list[str] = []

    def list_all(self, prefix: str) -> list[str]:
        return [p for p in self.objects if p.startswith(prefix)]

    def delete(self, paths: list[str]) -> None:
        for p in paths:
            self.objects.pop(p, None)

    def signed_upload_url(self, path: str) -> str:
        self.signed.append(path)
        return f"https://storage.test/upload/{path}?token=t"

    def signed_download_url(self, path: str, expires_in: int, filename: str) -> str:
        return f"https://storage.test/sign/{path}?expires={expires_in}&download={filename}"

    def download(self, path: str, max_bytes: int) -> bytes:
        if path not in self.objects:
            raise ApiError(404, "not_found", "gone")
        data = self.objects[path]
        if len(data) > max_bytes:
            raise ApiError(413, "file_too_large", "too big")
        return data


class _Result:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def fetchone(self) -> dict[str, Any] | None:
        return self.rows[0] if self.rows else None

    def fetchall(self) -> list[dict[str, Any]]:
        return self.rows


@dataclass
class FakeConn:
    sessions: dict[str, str] = field(default_factory=dict)  # session_id -> user_id
    audit: list[tuple[str, str | None]] = field(default_factory=list)
    hits: dict[tuple[str, str], int] = field(default_factory=dict)

    def execute(self, sql: str, params: Any = None) -> _Result:
        q = re.sub(r"\s+", " ", sql).strip().lower()
        if q.startswith("insert into internal.rate_limits"):
            key = (params["s"], params["b"])
            self.hits[key] = self.hits.get(key, 0) + 1
            return _Result([{"count": self.hits[key], "retry": 60}])
        if q.startswith("select 1 from public.study_sessions where id = %s and user_id = %s"):
            sid, uid = params
            return _Result([{"?column?": 1}] if self.sessions.get(sid) == uid else [])
        if q.startswith("delete from public.study_sessions where id = %s and user_id = %s"):
            sid, uid = params
            if self.sessions.get(sid) == uid:
                del self.sessions[sid]
            return _Result([])
        if q.startswith("insert into internal.audit_log"):
            self.audit.append((params[1], params[0]))
            return _Result([])
        raise AssertionError(f"FakeConn: unexpected SQL: {q[:80]}")

    def commit(self) -> None:
        pass
