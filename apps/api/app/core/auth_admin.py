"""Supabase Auth admin calls (server-only, secret key). Used only to delete an account."""

from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import get_settings
from app.core.errors import ApiError


class AuthAdmin(Protocol):
    def delete_user(self, user_id: str) -> None: ...


class SupabaseAuthAdmin:
    def __init__(self, base_url: str, secret_key: str) -> None:
        headers = {"apikey": secret_key}
        if secret_key.startswith("eyJ"):  # legacy service_role JWT
            headers["Authorization"] = f"Bearer {secret_key}"
        self.base = f"{base_url.rstrip('/')}/auth/v1/admin"
        self.http = httpx.Client(headers=headers, timeout=httpx.Timeout(15.0, connect=5.0))

    def delete_user(self, user_id: str) -> None:
        # Deleting the auth user ends every session (refresh tokens stop working) and cascades to
        # every public table, all of which reference auth.users on delete cascade.
        r = self.http.delete(f"{self.base}/users/{user_id}")
        if r.status_code >= 400 and r.status_code != 404:
            raise ApiError(
                502, "auth_error", "Your account couldn't be deleted just now. Try again."
            )


@lru_cache
def get_auth_admin() -> AuthAdmin:
    s = get_settings()
    return SupabaseAuthAdmin(s.supabase_url, s.supabase_secret_key.get_secret_value())
