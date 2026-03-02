import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings


ALGORITHM = "HS256"
oauth2_scheme = HTTPBearer(auto_error=False)


def _hash_refresh_token(plain_token: str) -> str:
    """Hash a refresh token for storage or lookup (SHA-256 with secret salt)."""
    raw = f"{settings.SECRET_KEY}:{plain_token}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def create_refresh_token(
    subject: str, expires_days: Optional[int] = None
) -> tuple[str, str, datetime]:
    """
    Generate a new refresh token. Returns (plain_token, token_hash, expires_at).
    Caller stores token_hash and expires_at in DB.
    """
    expires_days = expires_days if expires_days is not None else settings.REFRESH_TOKEN_EXPIRE_DAYS
    plain = secrets.token_urlsafe(32)
    token_hash = _hash_refresh_token(plain)
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)
    return (plain, token_hash, expires_at)


def hash_refresh_token(plain_token: str) -> str:
    """Hash an incoming refresh token for DB lookup."""
    return _hash_refresh_token(plain_token)


def create_access_token(subject: str, wholesaler_id: Optional[str] = None, expires_minutes: int = 60) -> str:
    now = datetime.now(timezone.utc)
    to_encode: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    if wholesaler_id is not None:
        to_encode["wholesaler_id"] = wholesaler_id
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from exc
    return payload


async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(oauth2_scheme)) -> dict[str, Any]:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = credentials.credentials
    payload = decode_token(token)

    # For now we just return the raw payload. Later this should load user from DB.
    return payload

