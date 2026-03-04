import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db
from core.otp import generate_otp_with_expiry, hash_otp, verify_otp_hash
from core.security import create_access_token, create_refresh_token, hash_refresh_token
from db.models import OtpVerification, RefreshToken, User, Wholesaler
from services.sms import SmsSendError, get_sms_provider

logger = logging.getLogger(__name__)
router = APIRouter()

MIN_PHONE_DIGITS = 8
MAX_PHONE_DIGITS = 15

# --- Standardized OTP error codes (never expose Twilio/provider details to client) ---
ERROR_CODE_TRIAL_UNVERIFIED = "TRIAL_UNVERIFIED_NUMBER"
ERROR_CODE_INVALID_PHONE = "INVALID_PHONE_NUMBER"
ERROR_CODE_SMS_PROVIDER = "SMS_PROVIDER_ERROR"
ERROR_CODE_SMS_NOT_CONFIGURED = "SMS_NOT_CONFIGURED"

# Twilio error codes we map to safe user messages (see Twilio Error Dictionary)
TWILIO_CODE_UNVERIFIED_TRIAL = 21608
TWILIO_CODE_INVALID_TO = 21211
TWILIO_CODE_INVALID_MOBILE = 21614

# Safe user-facing messages (no phone numbers, no provider names)
OTP_ERROR_MESSAGES = {
    ERROR_CODE_TRIAL_UNVERIFIED: (
        "We can't send a code to this number right now. Trial accounts can only send to verified numbers. "
        "Please contact support or try again later."
    ),
    ERROR_CODE_INVALID_PHONE: (
        "This phone number doesn't look valid. Please check the number and country code, then try again."
    ),
    ERROR_CODE_SMS_PROVIDER: "Unable to send OTP. Please try again.",
    ERROR_CODE_SMS_NOT_CONFIGURED: "SMS service is not configured. Please contact support.",
}


def _otp_error_response(error_code: str, message: str | None = None) -> dict:
    """Standardized error body for OTP failures: error_code + message (safe for frontend)."""
    return {
        "error_code": error_code,
        "message": message or OTP_ERROR_MESSAGES.get(error_code, "Unable to send OTP. Please try again."),
    }


class SendOtpRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)


class VerifyOtpRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)
    code: str = Field(..., min_length=6, max_length=6)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


def normalize_phone(phone: str) -> str:
    """Normalize to digits only (E.164 without +)."""
    return "".join(c for c in phone if c.isdigit())


def validate_phone_digits(phone: str) -> None:
    digits = normalize_phone(phone)
    if len(digits) < MIN_PHONE_DIGITS or len(digits) > MAX_PHONE_DIGITS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Phone must be {MIN_PHONE_DIGITS}-{MAX_PHONE_DIGITS} digits",
        )


@router.post("/send-otp")
async def send_otp(body: SendOtpRequest, db=Depends(get_db)):
    logger.info("send_otp received body.phone=%r (length=%d)", body.phone, len(body.phone or ""))

    # Normalize and validate: digits only, 8–15 digits
    phone = normalize_phone(body.phone)
    validate_phone_digits(body.phone)
    phone_e164 = f"+{phone}"  # E.164 for logging and SMS
    logger.info("send_otp normalized phone (last 4): ***%s e164=%s", phone[-4:] if len(phone) >= 4 else "****", phone_e164)

    # Rate limit: do not send again if we sent recently
    cooldown = timedelta(seconds=settings.OTP_SEND_COOLDOWN_SECONDS)
    since = datetime.now(timezone.utc) - cooldown
    recent = await db.execute(
        select(OtpVerification).where(
            OtpVerification.phone == phone,
            OtpVerification.created_at >= since,
        ).order_by(OtpVerification.created_at.desc()).limit(1)
    )
    if recent.scalar_one_or_none():
        logger.warning("send_otp rate limited for ***%s", phone[-4:] if len(phone) >= 4 else "****")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait before requesting another OTP",
        )

    otp, expires_at = generate_otp_with_expiry()
    otp_hash = hash_otp(otp)

    record = OtpVerification(phone=phone, otp_hash=otp_hash, expires_at=expires_at)
    db.add(record)
    await db.flush()
    logger.info("send_otp OTP record created for ***%s expires_at=%s", phone[-4:] if len(phone) >= 4 else "****", expires_at)

    message = (
        f"Your Kanaka Dhara verification code is: {otp}. "
        f"Valid for {settings.OTP_EXPIRY_MINUTES} minutes."
    )
    provider_name = (settings.OTP_SMS_PROVIDER or "twilio").strip().lower()
    logger.info("send_otp using provider=%s", provider_name)

    try:
        provider = get_sms_provider()
    except ValueError as e:
        logger.exception("send_otp get_sms_provider failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_otp_error_response(ERROR_CODE_SMS_NOT_CONFIGURED),
        ) from e

    try:
        await provider.send_sms(phone_e164, message)
        logger.info("OTP sent successfully via %s to ***%s", provider_name, phone[-4:] if len(phone) >= 4 else "****")
    except SmsSendError as e:
        # Map Twilio codes to safe error_code + message; never expose raw Twilio text to client
        try:
            code = int(e.twilio_code) if e.twilio_code is not None else None
        except (TypeError, ValueError):
            code = None
        if code == TWILIO_CODE_UNVERIFIED_TRIAL:
            error_code = ERROR_CODE_TRIAL_UNVERIFIED
        elif code in (TWILIO_CODE_INVALID_TO, TWILIO_CODE_INVALID_MOBILE):
            error_code = ERROR_CODE_INVALID_PHONE
        else:
            error_code = ERROR_CODE_SMS_PROVIDER
        safe_message = OTP_ERROR_MESSAGES.get(error_code, OTP_ERROR_MESSAGES[ERROR_CODE_SMS_PROVIDER])
        logger.warning(
            "send_otp SmsSendError twilio_code=%s mapped to error_code=%s (raw message not sent to client)",
            code,
            error_code,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_otp_error_response(error_code, safe_message),
        ) from e
    except Exception as e:
        logger.exception(
            "send_otp unexpected error via %s to ***%s: %s",
            provider_name,
            phone[-4:] if len(phone) >= 4 else "****",
            e,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_otp_error_response(ERROR_CODE_SMS_PROVIDER),
        ) from e

    await db.commit()
    logger.info("send_otp committed OTP record for ***%s", phone[-4:] if len(phone) >= 4 else "****")

    # In development (console provider), return OTP so frontend can show it for testing
    response: dict = {"message": "OTP sent"}
    if provider_name == "console":
        response["dev_otp"] = otp
        logger.info("Dev mode: OTP returned in response for ***%s", phone[-4:] if len(phone) >= 4 else "****")
    return response


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    phone = normalize_phone(body.phone)
    validate_phone_digits(body.phone)
    code = body.code.strip()

    result = await db.execute(
        select(OtpVerification)
        .where(OtpVerification.phone == phone)
        .order_by(OtpVerification.created_at.desc())
        .limit(1)
    )
    record = result.scalar_one_or_none()
    if not record or record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP",
        )
    if not verify_otp_hash(code, record.otp_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP",
        )

    # Delete OTP so it cannot be reused
    await db.delete(record)

    # Get or create user by phone
    user_result = await db.execute(select(User).where(User.phone == phone))
    user = user_result.scalar_one_or_none()
    if not user:
        user = User(phone=phone)
        db.add(user)
        await db.flush()

    # Check for wholesaler profile
    wholesaler_result = await db.execute(
        select(Wholesaler).where(Wholesaler.user_id == user.id)
    )
    wholesaler = wholesaler_result.scalar_one_or_none()

    # Issue refresh token and persist
    plain_refresh, token_hash, expires_at = create_refresh_token(user.id)
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(refresh_record)
    await db.commit()

    access_token = create_access_token(
        subject=user.id,
        wholesaler_id=wholesaler.id if wholesaler else None,
    )

    return {
        "access_token": access_token,
        "refresh_token": plain_refresh,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "phone": user.phone,
            "wholesalerId": wholesaler.id if wholesaler else None,
        },
        "has_wholesaler": wholesaler is not None,
    }


@router.post("/refresh")
async def refresh_access_token(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange a valid refresh token for a new access token.
    Returns 401 if the refresh token is invalid or expired.
    """
    token_hash = hash_refresh_token(body.refresh_token)
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    # Optional rotation: revoke this refresh token so it cannot be reused
    record.revoked_at = now
    await db.flush()

    user_result = await db.execute(select(User).where(User.id == record.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    wholesaler_result = await db.execute(
        select(Wholesaler).where(Wholesaler.user_id == user.id)
    )
    wholesaler = wholesaler_result.scalar_one_or_none()
    await db.commit()

    new_access_token = create_access_token(
        subject=user.id,
        wholesaler_id=wholesaler.id if wholesaler else None,
    )
    # Issue new refresh token (rotation)
    plain_refresh, new_hash, new_expires = create_refresh_token(user.id)
    new_record = RefreshToken(
        user_id=user.id,
        token_hash=new_hash,
        expires_at=new_expires,
    )
    db.add(new_record)
    await db.commit()

    return {
        "access_token": new_access_token,
        "refresh_token": plain_refresh,
        "token_type": "bearer",
    }
