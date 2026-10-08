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
    groq_api_key: SecretStr = SecretStr("")
    max_upload_mb: int = 50

    # Groq model routing (verify against console.groq.com/docs/models before changing)
    groq_model_small: str = "llama-3.1-8b-instant"
    groq_model_large: str = "llama-3.3-70b-versatile"

    @property
    def is_prod(self) -> bool:
        return self.env == "production"

    @property
    def jwt_issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
