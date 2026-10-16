from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    database_url: SecretStr = SecretStr("postgresql://postgres:postgres@127.0.0.1:54322/postgres")
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_secret_key: SecretStr = SecretStr("")
    supabase_jwks_url: str = "http://127.0.0.1:54321/auth/v1/.well-known/jwks.json"
    ip_hash_salt: SecretStr = SecretStr("dev-only-salt")
    # Trust x-forwarded-for only behind a proxy we control (Vercel). Off by default: a client can
    # send any x-forwarded-for, so trusting it would let them pick a fresh rate-limit bucket.
    trusted_proxy: bool = False
    # Local demos only: new teachers are verified at once instead of waiting for manual review.
    # Never true in production (SECURITY.md: teachers are checked before they reach students).
    teacher_auto_verify: bool = False
    db_pool: bool = True  # tests against a single-connection Postgres turn the pool off
    # Class rules (ROADMAP v0.5). Lower them only for a local demo with a couple of accounts.
    class_min_students: int = 10
    class_min_lead_min: int = 30  # how far ahead a room must start; 0 allows "Start now"
    # Jitsi server for live classes. meet.jit.si makes the host sign in with Google/GitHub
    # (since Aug 2023); a community server like https://meet.ffmuc.net doesn't.
    # Self-host for production.
    video_base_url: str = "https://meet.jit.si"
    groq_api_key: SecretStr = SecretStr("")
    max_upload_mb: int = 50

    # Groq model routing: models this project's key can use (checked 2026-10-09; the Llama IDs
    # returned model_not_found). Verify against console.groq.com/docs/models before changing.
    groq_model_small: str = "openai/gpt-oss-20b"
    groq_model_large: str = "openai/gpt-oss-120b"

    @property
    def is_prod(self) -> bool:
        return self.env == "production"

    @property
    def jwt_issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
