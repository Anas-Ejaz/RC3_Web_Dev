"""Application settings, loaded only from environment variables / .env."""
from functools import lru_cache

from pydantic import field_validator
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    environment: str = "development"
    log_level: str = "INFO"
    api_prefix: str = "/api/v1"
    frontend_url: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql://neondb_owner:npg_wzRWSty7LJK2@ep-quiet-tree-azy7a59l-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

    # Auth
    jwt_secret: str = "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"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cookie_name: str = "access_token"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    login_max_attempts: int = 5
    login_window_seconds: int = 300

    # Groq
    groq_api_key: str = ""
    groq_model_extract: str = "llama-3.3-70b-versatile"
    groq_model_explain: str = "llama-3.3-70b-versatile"
    groq_timeout_seconds: int = 30

    # Embeddings
    embedding_provider: str = "fastembed"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dim: int = 384

    # Uploads / retention
    max_upload_mb: int = 5
    talent_pool_retention_days: int = 180  # was 365; the spec and test_talent assume 180
    duplicate_similarity_threshold: float = 0.92  # DUPLICATE_SIMILARITY_THRESHOLD

    @field_validator("frontend_url")
    @classmethod
    def _strip_trailing_slash(cls, v: str) -> str:
        return v.rstrip("/")

    @field_validator("database_url")
    @classmethod
    def _force_psycopg_driver(cls, v: str) -> str:
        """Hosted providers often hand out postgres:// or postgresql:// URLs; normalize to psycopg v3."""
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+psycopg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    @model_validator(mode="after")
    def _check_deployment_safety(self):
        self.cookie_samesite = self.cookie_samesite.lower()
        if self.cookie_samesite not in ("lax", "strict", "none"):
            raise ValueError("COOKIE_SAMESITE must be lax, strict or none")
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true (browsers drop the cookie otherwise)")
        if self.is_production:
            if self.jwt_secret in ("", "change-me") or len(self.jwt_secret) < 32:
                raise ValueError("Set a strong JWT_SECRET (32+ chars) in production")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()