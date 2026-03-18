"""Tests for core.otp helpers."""

from core import otp


def test_hash_and_verify_otp_round_trip() -> None:
    code = "123456"
    hashed = otp.hash_otp(code)
    assert hashed != code
    assert otp.verify_otp_hash(code, hashed)
    assert not otp.verify_otp_hash("654321", hashed)


def test_generate_otp_with_expiry() -> None:
    code, expires_at = otp.generate_otp_with_expiry()
    assert isinstance(code, str)
    assert len(code) == otp.settings.OTP_LENGTH
    # Expiry should be in the future
    from datetime import datetime, timezone

    assert expires_at > datetime.now(timezone.utc)


def test_generate_otp_length() -> None:
    from app.config import settings

    for _ in range(3):
        code = otp.generate_otp()
        assert len(code) == settings.OTP_LENGTH
        assert code.isdigit()


def test_get_expiry_time() -> None:
    from datetime import datetime, timezone

    from app.config import settings

    t = otp.get_expiry_time()
    assert t > datetime.now(timezone.utc)
    assert (t - datetime.now(timezone.utc)).total_seconds() <= (
        settings.OTP_EXPIRY_MINUTES * 60 + 5
    )

