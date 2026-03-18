"""Auth API tests: OTP and refresh token flows."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.otp import generate_otp_with_expiry, hash_otp
from db.models import OtpVerification, RefreshToken, User, Wholesaler


@pytest.mark.asyncio
async def test_send_otp_success_console_provider(
    api_client: AsyncClient,
    fake_sms_provider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /auth/send-otp sends SMS and returns dev_otp when provider=console."""
    # Force console provider so dev_otp is included in response
    from app import config as app_config

    monkeypatch.setattr(app_config.settings, "OTP_SMS_PROVIDER", "console", raising=False)

    r = await api_client.post("/api/v1/auth/send-otp", json={"phone": "+91 98765 43210"})
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "OTP sent"
    # In console mode, dev_otp should be present for testing
    assert "dev_otp" in body
    # Our fake provider should have recorded exactly one SMS
    assert len(fake_sms_provider) == 1
    assert "9876543210" in fake_sms_provider[0]["to"]


@pytest.mark.asyncio
async def test_send_otp_invalid_phone_too_short(api_client: AsyncClient) -> None:
    """Phone with too few digits (after normalizing) returns 400 with a helpful message."""
    # Pass Pydantic min_length=8 but supply only 7 digits so handler raises 400
    r = await api_client.post("/api/v1/auth/send-otp", json={"phone": "1234567X"})
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert "Phone must" in detail


@pytest.mark.asyncio
async def test_refresh_token_invalid_token(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """Invalid refresh token should return 401."""
    _session, _wid = test_session_and_wholesaler_id
    r = await api_client.post("/api/v1/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert r.status_code == 401
    assert "Invalid or expired refresh token" in r.json()["detail"]


@pytest.mark.asyncio
async def test_verify_otp_success_creates_user_and_tokens(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """verify-otp with a valid code returns access/refresh tokens."""
    session, _wid = test_session_and_wholesaler_id

    # Seed an OTP record for a phone
    phone = "919999888877"
    otp, expires_at = generate_otp_with_expiry()
    otp_hash = hash_otp(otp)
    record = OtpVerification(phone=phone, otp_hash=otp_hash, expires_at=expires_at)
    session.add(record)
    await session.commit()

    # Call verify-otp with the same phone/code
    r = await api_client.post(
        "/api/v1/auth/verify-otp",
        json={"phone": phone, "code": otp},
    )
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["phone"].endswith(phone[-4:])


@pytest.mark.asyncio
async def test_send_otp_rate_limit_429(
    api_client: AsyncClient,
    fake_sms_provider,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.config import settings
    from db.models import OtpVerification

    session, _ = test_session_and_wholesaler_id
    monkeypatch.setattr(settings, "OTP_SEND_COOLDOWN_SECONDS", 99999)
    # Use same normalized form as auth (digits only, with country code)
    phone = "919876543210"
    otp, exp = generate_otp_with_expiry()
    rec = OtpVerification(phone=phone, otp_hash=hash_otp(otp), expires_at=exp)
    session.add(rec)
    await session.commit()
    r = await api_client.post("/api/v1/auth/send-otp", json={"phone": "+91 9876543210"})
    assert r.status_code == 429
    assert "wait" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_send_otp_sms_not_configured_503(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api import v1 as api_v1
    from services import sms as sms_module

    def raise_value_error():
        raise ValueError("SMS not configured")

    monkeypatch.setattr(api_v1.auth, "get_sms_provider", raise_value_error)
    monkeypatch.setattr(sms_module, "get_sms_provider", raise_value_error)
    r = await api_client.post("/api/v1/auth/send-otp", json={"phone": "+919876543210"})
    assert r.status_code == 503
    detail = r.json()["detail"]
    assert detail.get("error_code") == "SMS_NOT_CONFIGURED" or "not configured" in str(detail).lower()


@pytest.mark.asyncio
async def test_send_otp_sms_send_error_trial_unverified_503(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api import v1 as api_v1
    from services import sms as sms_module
    from services.sms import SmsSendError

    class FakeProvider:
        async def send_sms(self, to: str, message: str) -> None:
            raise SmsSendError("Trial", twilio_code=21608)

    monkeypatch.setattr(api_v1.auth, "get_sms_provider", lambda: FakeProvider())
    monkeypatch.setattr(sms_module, "get_sms_provider", lambda: FakeProvider())
    r = await api_client.post("/api/v1/auth/send-otp", json={"phone": "+919876543210"})
    assert r.status_code == 503
    assert "TRIAL" in str(r.json()["detail"]).upper() or "trial" in str(r.json()["detail"]).lower()


@pytest.mark.asyncio
async def test_send_otp_sms_send_error_invalid_phone_503(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api import v1 as api_v1
    from services import sms as sms_module
    from services.sms import SmsSendError

    class FakeProvider:
        async def send_sms(self, to: str, message: str) -> None:
            raise SmsSendError("Invalid", twilio_code=21211)

    monkeypatch.setattr(api_v1.auth, "get_sms_provider", lambda: FakeProvider())
    monkeypatch.setattr(sms_module, "get_sms_provider", lambda: FakeProvider())
    r = await api_client.post("/api/v1/auth/send-otp", json={"phone": "+919876543210"})
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_send_otp_sms_send_error_generic_503(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api import v1 as api_v1
    from services import sms as sms_module
    from services.sms import SmsSendError

    class FakeProvider:
        async def send_sms(self, to: str, message: str) -> None:
            raise SmsSendError("Generic", twilio_code=99999)

    monkeypatch.setattr(api_v1.auth, "get_sms_provider", lambda: FakeProvider())
    monkeypatch.setattr(sms_module, "get_sms_provider", lambda: FakeProvider())
    r = await api_client.post("/api/v1/auth/send-otp", json={"phone": "+919876543210"})
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_send_otp_unexpected_exception_503(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api import v1 as api_v1
    from services import sms as sms_module

    class FakeProvider:
        async def send_sms(self, to: str, message: str) -> None:
            raise RuntimeError("Unexpected")

    monkeypatch.setattr(api_v1.auth, "get_sms_provider", lambda: FakeProvider())
    monkeypatch.setattr(sms_module, "get_sms_provider", lambda: FakeProvider())
    r = await api_client.post("/api/v1/auth/send-otp", json={"phone": "+919876543210"})
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_verify_otp_invalid_expired_400(api_client: AsyncClient) -> None:
    r = await api_client.post(
        "/api/v1/auth/verify-otp", json={"phone": "+919876543210", "code": "000000"}
    )
    assert r.status_code == 400
    assert "Invalid or expired" in r.json()["detail"]


@pytest.mark.asyncio
async def test_verify_otp_wrong_code_400(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    session, _ = test_session_and_wholesaler_id
    phone = "9876543211"
    otp, exp = generate_otp_with_expiry()
    rec = OtpVerification(phone=phone, otp_hash=hash_otp(otp), expires_at=exp)
    session.add(rec)
    await session.commit()
    r = await api_client.post("/api/v1/auth/verify-otp", json={"phone": phone, "code": "000000"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_refresh_token_success_200(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    from core.security import create_refresh_token
    from db.models import RefreshToken

    session, _ = test_session_and_wholesaler_id
    result = await session.execute(select(User).limit(1))
    user = result.scalar_one()
    plain, token_hash, expires_at = create_refresh_token(str(user.id))
    ref = RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at)
    session.add(ref)
    await session.commit()
    r = await api_client.post("/api/v1/auth/refresh", json={"refresh_token": plain})
    assert r.status_code == 200
    assert "access_token" in r.json() and "refresh_token" in r.json()


@pytest.mark.asyncio
async def test_refresh_token_user_not_found_401(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """Refresh token valid but user was deleted: API returns 401."""
    from app.main import app
    from core.security import create_refresh_token
    from db.models import RefreshToken, User
    from app.dependencies import get_db

    session, _ = test_session_and_wholesaler_id
    user = (await session.execute(select(User).limit(1))).scalar_one()
    user_id = str(user.id)
    plain, token_hash, expires_at = create_refresh_token(user_id)
    ref = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
    session.add(ref)
    await session.commit()

    class EmptyUserResult:
        def scalar_one_or_none(self):
            return None

    execute_count = 0

    async def mock_execute(self, statement):
        nonlocal execute_count
        execute_count += 1
        if execute_count == 2:
            return EmptyUserResult()
        return await session.execute(statement)

    class MockSession:
        def __init__(self, real_session):
            self._real = real_session
        execute = mock_execute
        async def flush(self):
            await self._real.flush()
        async def commit(self):
            await self._real.commit()
        async def rollback(self):
            await self._real.rollback()
        def add(self, x):
            self._real.add(x)
        @property
        def sync_session(self):
            return self._real.sync_session

    async def override_get_db():
        yield MockSession(session)

    app.dependency_overrides[get_db] = override_get_db
    try:
        r = await api_client.post("/api/v1/auth/refresh", json={"refresh_token": plain})
        assert r.status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_send_otp_sms_send_error_twilio_code_non_int_503(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SmsSendError with non-int twilio_code hits TypeError path and returns 503."""
    from api import v1 as api_v1
    from services import sms as sms_module
    from services.sms import SmsSendError

    class FakeProvider:
        async def send_sms(self, to: str, message: str) -> None:
            raise SmsSendError("Error", twilio_code="not_an_int")

    monkeypatch.setattr(api_v1.auth, "get_sms_provider", lambda: FakeProvider())
    monkeypatch.setattr(sms_module, "get_sms_provider", lambda: FakeProvider())
    r = await api_client.post("/api/v1/auth/send-otp", json={"phone": "+919876543210"})
    assert r.status_code == 503


# --- OTP verification: all branches ---


@pytest.mark.asyncio
async def test_verify_otp_record_not_found_400(api_client: AsyncClient) -> None:
    """verify_otp when no OTP record exists for phone returns 400 (record is None)."""
    r = await api_client.post(
        "/api/v1/auth/verify-otp",
        json={"phone": "+911122223333", "code": "123456"},
    )
    assert r.status_code == 400
    assert "Invalid or expired" in r.json()["detail"]


@pytest.mark.asyncio
async def test_verify_otp_expired_400(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """verify_otp when OTP record has expires_at in the past returns 400."""
    session, _ = test_session_and_wholesaler_id
    phone = "919998887766"
    otp, _ = generate_otp_with_expiry()
    expired_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    record = OtpVerification(
        phone=phone, otp_hash=hash_otp(otp), expires_at=expired_at
    )
    session.add(record)
    await session.commit()
    r = await api_client.post(
        "/api/v1/auth/verify-otp", json={"phone": phone, "code": otp}
    )
    assert r.status_code == 400
    assert "Invalid or expired" in r.json()["detail"]


@pytest.mark.asyncio
async def test_verify_otp_invalid_code_400(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """verify_otp when verify_otp_hash returns False returns 400."""
    session, _ = test_session_and_wholesaler_id
    phone = "919998887755"
    otp, exp = generate_otp_with_expiry()
    record = OtpVerification(phone=phone, otp_hash=hash_otp(otp), expires_at=exp)
    session.add(record)
    await session.commit()
    r = await api_client.post(
        "/api/v1/auth/verify-otp", json={"phone": phone, "code": "000000"}
    )
    assert r.status_code == 400
    assert "Invalid or expired" in r.json()["detail"]


@pytest.mark.asyncio
async def test_verify_otp_valid_new_user_creation(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """verify_otp with valid code and no existing user creates user and returns tokens."""
    session, _ = test_session_and_wholesaler_id
    phone = "919998887744"
    otp, exp = generate_otp_with_expiry()
    record = OtpVerification(phone=phone, otp_hash=hash_otp(otp), expires_at=exp)
    session.add(record)
    await session.commit()
    r = await api_client.post(
        "/api/v1/auth/verify-otp", json={"phone": phone, "code": otp}
    )
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data and "refresh_token" in data
    assert data["user"]["phone"] == phone
    assert data["has_wholesaler"] is False
    assert data["user"]["wholesalerId"] is None


@pytest.mark.asyncio
async def test_verify_otp_valid_existing_user(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """verify_otp with valid code and existing user (no new user creation) returns tokens."""
    session, wid = test_session_and_wholesaler_id
    result = await session.execute(
        select(User).join(Wholesaler).where(Wholesaler.id == wid)
    )
    user = result.scalar_one()
    normalized_phone = "919876543210"
    user.phone = normalized_phone
    await session.commit()
    otp, exp = generate_otp_with_expiry()
    record = OtpVerification(
        phone=normalized_phone, otp_hash=hash_otp(otp), expires_at=exp
    )
    session.add(record)
    await session.commit()
    r = await api_client.post(
        "/api/v1/auth/verify-otp",
        json={"phone": f"+91 {normalized_phone[2:]}", "code": otp},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["id"] == str(user.id)
    assert data["user"]["phone"] == normalized_phone


@pytest.mark.asyncio
async def test_verify_otp_valid_wholesaler_exists(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """verify_otp when user has wholesaler profile returns has_wholesaler True and wholesalerId."""
    session, wid = test_session_and_wholesaler_id
    result = await session.execute(
        select(User).join(Wholesaler).where(Wholesaler.id == wid)
    )
    user = result.scalar_one()
    normalized_phone = "919876543210"
    user.phone = normalized_phone
    await session.commit()
    otp, exp = generate_otp_with_expiry()
    record = OtpVerification(
        phone=normalized_phone, otp_hash=hash_otp(otp), expires_at=exp
    )
    session.add(record)
    await session.commit()
    r = await api_client.post(
        "/api/v1/auth/verify-otp",
        json={"phone": normalized_phone, "code": otp},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["has_wholesaler"] is True
    assert data["user"]["wholesalerId"] == wid


@pytest.mark.asyncio
async def test_verify_otp_valid_wholesaler_not_exists(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """verify_otp when user has no wholesaler returns has_wholesaler False."""
    session, _ = test_session_and_wholesaler_id
    phone = "919998887733"
    otp, exp = generate_otp_with_expiry()
    record = OtpVerification(phone=phone, otp_hash=hash_otp(otp), expires_at=exp)
    session.add(record)
    await session.commit()
    r = await api_client.post(
        "/api/v1/auth/verify-otp", json={"phone": phone, "code": otp}
    )
    assert r.status_code == 200
    assert r.json()["has_wholesaler"] is False
    assert r.json()["user"]["wholesalerId"] is None


# --- Refresh token: all branches ---


@pytest.mark.asyncio
async def test_refresh_token_not_found_401(api_client: AsyncClient) -> None:
    """refresh when refresh token is invalid or not in DB returns 401."""
    r = await api_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid-or-nonexistent-token"},
    )
    assert r.status_code == 401
    assert "Invalid or expired refresh token" in r.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_token_valid_without_wholesaler_200(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """refresh with valid token for user that has no wholesaler returns 200 and new tokens."""
    from core.security import create_refresh_token

    session, _ = test_session_and_wholesaler_id
    user_no_wholesaler = User(phone="+919999999988")
    session.add(user_no_wholesaler)
    await session.commit()
    await session.refresh(user_no_wholesaler)
    plain, token_hash, expires_at = create_refresh_token(str(user_no_wholesaler.id))
    ref = RefreshToken(
        user_id=user_no_wholesaler.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    session.add(ref)
    await session.commit()
    r = await api_client.post("/api/v1/auth/refresh", json={"refresh_token": plain})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data and "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_refresh_token_rotation_old_revoked_new_works(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """After refresh, old token is revoked; new token works for another refresh."""
    from core.security import create_refresh_token

    session, _ = test_session_and_wholesaler_id
    result = await session.execute(select(User).limit(1))
    user = result.scalar_one()
    plain_a, hash_a, exp_a = create_refresh_token(str(user.id))
    ref_a = RefreshToken(user_id=user.id, token_hash=hash_a, expires_at=exp_a)
    session.add(ref_a)
    await session.commit()
    r1 = await api_client.post("/api/v1/auth/refresh", json={"refresh_token": plain_a})
    assert r1.status_code == 200
    new_refresh = r1.json()["refresh_token"]
    r2 = await api_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_refresh}
    )
    assert r2.status_code == 200
    r3 = await api_client.post("/api/v1/auth/refresh", json={"refresh_token": plain_a})
    assert r3.status_code == 401

