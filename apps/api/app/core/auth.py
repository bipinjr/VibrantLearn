"""Verify Supabase access tokens against the project's JWKS (asymmetric keys, SECURITY.md §4)."""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, Header

from app.core.config import get_settings
from app.core.errors import ApiError


@dataclass(frozen=True)
class User:
    id: str


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    # Keys cached in memory for 5 minutes per warm instance.
    return jwt.PyJWKClient(
        get_settings().supabase_jwks_url, cache_keys=True, lifespan=300, timeout=5
    )


def _unauthorized(msg: str = "Sign in again to continue.") -> ApiError:
    return ApiError(401, "unauthorized", msg, headers={"WWW-Authenticate": "Bearer"})


def verify_token(token: str) -> User:
    s = get_settings()
    try:
        key = _jwks().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=s.jwt_issuer,
            options={"require": ["exp", "sub", "aud", "iss"]},
            leeway=30,  # small clock differences between the browser, Supabase and us
        )
    except (jwt.PyJWTError, jwt.PyJWKClientError) as e:
        raise _unauthorized() from e
    if claims.get("role") != "authenticated" or claims.get("is_anonymous"):
        raise _unauthorized()
    return User(id=str(claims["sub"]))


def current_user(authorization: Annotated[str | None, Header()] = None) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise _unauthorized()
    return verify_token(authorization.removeprefix("Bearer ").strip())


CurrentUser = Annotated[User, Depends(current_user)]
