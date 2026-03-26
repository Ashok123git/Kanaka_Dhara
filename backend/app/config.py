from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings
from pydantic import model_validator


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kanaka_dhara"
    TEST_DATABASE_URL: str | None = None  # Dedicated test DB, e.g. .../kanaka_dhara_test
    SECRET_KEY: str = "CHANGE_ME_SECRET_KEY"
    AUTO_CREATE_DB_SCHEMA: bool = True
    # Str from .env (comma-separated); use .cors_origins_list for middleware
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    OTP_LENGTH: int = 6
    OTP_EXPIRY_MINUTES: int = 10
    OTP_SEND_COOLDOWN_SECONDS: int = 60
    # "twilio" = use Twilio for OTP in both dev and production (default when Twilio creds set)
    OTP_SMS_PROVIDER: str = "twilio"
    # Twilio (required for OTP when OTP_SMS_PROVIDER=twilio)
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_FROM_NUMBER: str | None = None

    # Local file storage for transaction attachments
    UPLOAD_DIR: str = "uploads"
    # Refresh token validity (days)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    @property
    def cors_origins_list(self) -> List[str]:
        """Origins for CORS (no trailing slash) so they match the browser Origin header exactly."""
        return [str(AnyHttpUrl(u.strip())).rstrip("/") for u in self.CORS_ORIGINS.split(",") if u.strip()]

    @model_validator(mode="after")
    def _normalize_database_url(self) -> "Settings":
        """
        Render (and some other providers) supply `DATABASE_URL` as `postgres://...` or `postgresql://...`.
        For SQLAlchemy async we need an explicit async driver: `postgresql+asyncpg://...`.
        """
        url = (self.DATABASE_URL or "").strip()
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://") and "+asyncpg" not in url.split("://", 1)[0]:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        self.DATABASE_URL = url
        return self

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

