import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Tuple

from app.config import settings


def hash_otp(otp: str) -> str:
    """Return SHA-256 hex digest of OTP for storage."""
    return hashlib.sha256(otp.encode()).hexdigest()


def verify_otp_hash(otp: str, stored_hash: str) -> bool:
    """Constant-time comparison of OTP against stored hash."""
    return hmac.compare_digest(hash_otp(otp), stored_hash)


def generate_otp() -> str:
    """Generate a numeric OTP of configured length."""
    length = settings.OTP_LENGTH
    range_start = 10 ** (length - 1)
    range_end = (10**length) - 1
    return str(secrets.randbelow(range_end - range_start + 1) + range_start)


def get_expiry_time() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)


def generate_otp_with_expiry() -> Tuple[str, datetime]:
    otp = generate_otp()
    expires_at = get_expiry_time()
    return otp, expires_at

