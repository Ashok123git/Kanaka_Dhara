import logging
from typing import Protocol

from app.config import settings

logger = logging.getLogger(__name__)


class SmsSendError(Exception):
    """Raised when SMS provider fails; may include provider-specific message for the user."""

    def __init__(self, message: str, twilio_code: int | None = None, twilio_message: str | None = None):
        super().__init__(message)
        self.twilio_code = twilio_code
        self.twilio_message = twilio_message


class SmsProvider(Protocol):
    async def send_sms(self, to: str, message: str) -> None:  # pragma: no cover - interface
        ...


class ConsoleSmsProvider:
    """Development SMS provider: logs to stdout only. No SMS is sent to the phone."""

    async def send_sms(self, to: str, message: str) -> None:
        # to may be E.164 (+123...) or digits; log last 4 for privacy
        mask = f"***{to[-4:]}" if len(to) >= 4 else "****"
        logger.info("Console SMS (no real send) to %s: %s", mask, message)
        print(f"[SMS to {to}]: {message}")


class TwilioSmsProvider:
    """Send SMS via Twilio API. Expects E.164 number (with or without +)."""

    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number
        self._base_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"

    async def send_sms(self, to: str, message: str) -> None:
        import httpx

        # Twilio expects E.164 with + prefix
        to_e164 = to if to.startswith("+") else f"+{to}"
        logger.info("Twilio send_sms: To=%s From=%s Body length=%d", to_e164, self.from_number, len(message))

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self._base_url,
                auth=(self.account_sid, self.auth_token),
                data={"To": to_e164, "From": self.from_number, "Body": message},
                timeout=30.0,
            )
            if not resp.is_success:
                # Parse Twilio error response for logging and user-facing message
                try:
                    err_body = resp.json()
                    twilio_code = err_body.get("code")
                    twilio_message = err_body.get("message", resp.text)
                    logger.error(
                        "Twilio API error status=%s code=%s message=%s",
                        resp.status_code,
                        twilio_code,
                        twilio_message,
                    )
                    raise SmsSendError(
                        f"Twilio error {resp.status_code}",
                        twilio_code=twilio_code,
                        twilio_message=twilio_message,
                    ) from None
                except (ValueError, KeyError):
                    logger.error("Twilio API error status=%s body=%s", resp.status_code, resp.text)
                    raise SmsSendError(
                        f"Twilio error {resp.status_code}",
                        twilio_message=resp.text[:500] if resp.text else "SMS provider error",
                    ) from None
            logger.info("Twilio SMS sent successfully to %s", to_e164)


def get_sms_provider() -> SmsProvider:
    """Use Twilio for OTP in both dev and production. Set OTP_SMS_PROVIDER=console only for local testing without SMS."""
    provider = (settings.OTP_SMS_PROVIDER or "twilio").strip().lower()
    if provider == "twilio":
        sid = settings.TWILIO_ACCOUNT_SID
        token = settings.TWILIO_AUTH_TOKEN
        from_num = settings.TWILIO_FROM_NUMBER
        if not sid or not token or not from_num:
            raise ValueError(
                "Twilio OTP requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in .env"
            )
        return TwilioSmsProvider(account_sid=sid, auth_token=token, from_number=from_num)
    return ConsoleSmsProvider()
