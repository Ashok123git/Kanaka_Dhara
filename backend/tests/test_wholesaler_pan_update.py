import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import create_access_token
from db.models import Wholesaler


@pytest.mark.asyncio
async def test_update_settings_does_not_clear_pan(
    api_client: AsyncClient, test_session_and_wholesaler_id
) -> None:
    """
    When updating wholesaler settings without sending panNumber,
    the existing PAN in the database must be preserved.
    """
    session, wholesaler_id = test_session_and_wholesaler_id

    # Seed an existing PAN on the wholesaler
    result = await session.execute(select(Wholesaler).where(Wholesaler.id == wholesaler_id))
    wholesaler = result.scalar_one()
    wholesaler.pan_number = "ABCDE1234F"
    await session.commit()

    # Authenticate as this wholesaler's user for /wholesalers/me (depends on get_current_user)
    token = create_access_token(subject=str(wholesaler.user_id), wholesaler_id=wholesaler_id)
    headers = {"Authorization": f"Bearer {token}"}

    original_trade_credit_days = wholesaler.trade_credit_days

    # Call the API like SettingsSheet: update tradeCreditDays only (no panNumber)
    payload = {
        "shopName": wholesaler.shop_name,
        "ownerName": wholesaler.owner_name,
        "mobile": wholesaler.mobile,
        "address": wholesaler.address,
        "gstNumber": wholesaler.gst_number,
        "status": wholesaler.status,
        "tradeCreditDays": original_trade_credit_days + 5,
    }

    response = await api_client.put("/api/v1/wholesalers/me", json=payload, headers=headers)
    assert response.status_code == 200

    # Reload from DB and ensure PAN is unchanged while trade_credit_days updated
    result = await session.execute(select(Wholesaler).where(Wholesaler.id == wholesaler_id))
    updated = result.scalar_one()
    assert updated.pan_number == "ABCDE1234F"
    assert updated.trade_credit_days == original_trade_credit_days + 5

