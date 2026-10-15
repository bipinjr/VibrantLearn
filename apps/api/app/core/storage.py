"""Supabase Storage over its REST API (httpx; no extra SDK). Server-only: uses the secret key.

Every object lives at {user_id}/{session_id}/{file_id}/{safe_name} in the private `user-files`
bucket. Callers pass paths they built from ids they already checked; this module never takes a
path straight from a request.
"""

from collections.abc import Iterator
from functools import lru_cache
from typing import Any, Protocol
from urllib.parse import quote

import httpx

from app.core.config import get_settings
from app.core.errors import ApiError

BUCKET = "user-files"
_TIMEOUT = httpx.Timeout(20.0, connect=5.0)


class Storage(Protocol):
    def list_all(self, prefix: str) -> list[str]: ...
    def delete(self, paths: list[str]) -> None: ...
    def signed_upload_url(self, path: str) -> str: ...
    def signed_download_url(self, path: str, expires_in: int, filename: str) -> str: ...
    def download(self, path: str, max_bytes: int) -> bytes: ...


class SupabaseStorage:
    def __init__(self, base_url: str, secret_key: str) -> None:
        self.base = f"{base_url.rstrip('/')}/storage/v1"
        headers = {"apikey": secret_key}
        # Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys are
        # sent as apikey only and the gateway maps them to the service role.
        if secret_key.startswith("eyJ"):
            headers["Authorization"] = f"Bearer {secret_key}"
        self.http = httpx.Client(headers=headers, timeout=_TIMEOUT)

    def _check(self, r: httpx.Response) -> httpx.Response:
        if r.status_code >= 400:
            raise ApiError(502, "storage_error", "File storage didn't respond. Try again.")
        return r

    def _list(self, prefix: str) -> Iterator[dict[str, Any]]:
        offset = 0
        while True:
            r = self._check(
                self.http.post(
                    f"{self.base}/object/list/{BUCKET}",
                    json={"prefix": prefix, "limit": 1000, "offset": offset},
                )
            )
            rows: list[dict[str, Any]] = r.json()
            yield from rows
            if len(rows) < 1000:
                return
            offset += 1000

    def list_all(self, prefix: str) -> list[str]:
        """Every object path under prefix ('a/b/'), walking sub-folders."""
        out: list[str] = []
        stack = [prefix.rstrip("/")]
        while stack:
            folder = stack.pop()
            for row in self._list(folder):
                path = f"{folder}/{row['name']}"
                # Folders come back without an id.
                (stack if row.get("id") is None else out).append(path)
        return out

    def delete(self, paths: list[str]) -> None:
        for i in range(0, len(paths), 1000):
            self._check(
                self.http.request(
                    "DELETE", f"{self.base}/object/{BUCKET}", json={"prefixes": paths[i : i + 1000]}
                )
            )

    def signed_upload_url(self, path: str) -> str:
        r = self._check(self.http.post(f"{self.base}/object/upload/sign/{BUCKET}/{path}"))
        return f"{self.base}{r.json()['url']}"

    def signed_download_url(self, path: str, expires_in: int, filename: str) -> str:
        r = self._check(
            self.http.post(
                f"{self.base}/object/sign/{BUCKET}/{path}", json={"expiresIn": expires_in}
            )
        )
        # download=… makes Storage send Content-Disposition: attachment (never render inline).
        return f"{self.base}{r.json()['signedURL']}&download={quote(filename)}"

    def download(self, path: str, max_bytes: int) -> bytes:
        with self.http.stream("GET", f"{self.base}/object/authenticated/{BUCKET}/{path}") as r:
            if r.status_code == 404:
                raise ApiError(404, "not_found", "That file isn't in storage any more.")
            self._check(r)
            buf = bytearray()
            for chunk in r.iter_bytes():
                buf += chunk
                if len(buf) > max_bytes:
                    raise ApiError(
                        413, "file_too_large", "This file is bigger than it said it was."
                    )
            return bytes(buf)


@lru_cache
def get_storage() -> Storage:
    s = get_settings()
    return SupabaseStorage(s.supabase_url, s.supabase_secret_key.get_secret_value())
