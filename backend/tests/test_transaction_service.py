"""Unit tests for TransactionService helper behavior."""

import datetime
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest

from db.models import Contact
from db.schemas import TransactionCreate
from services.transaction_service import (
    TransactionService,
    _balance_delta_for_type,
)


def test_balance_delta_for_order_received() -> None:
    assert _balance_delta_for_type("order_received", Decimal("100")) == Decimal("100")


def test_balance_delta_for_payment_and_goods_returned() -> None:
    assert _balance_delta_for_type("payment_received", Decimal("50")) == Decimal("-50")
    assert _balance_delta_for_type("goods_returned", Decimal("30")) == Decimal("-30")


def test_balance_delta_for_unknown_type_zero() -> None:
    assert _balance_delta_for_type("other", Decimal("10")) == Decimal("0")


@pytest.mark.asyncio
async def test_create_transaction_order_not_found_raises(
    test_session_and_wholesaler_id,
) -> None:
    """create_transaction with non-existent order_id raises ValueError order_not_found."""
    session, wholesaler_id = test_session_and_wholesaler_id
    contact = Contact(
        wholesaler_id=wholesaler_id,
        type="customer",
        name="Test",
        mobile="+919999999999",
    )
    session.add(contact)
    await session.commit()
    await session.refresh(contact)
    body = TransactionCreate(
        contact_id=str(contact.id),
        type="payment_received",
        date=datetime.date.today(),
        amount=Decimal("10"),
        order_id="00000000-0000-0000-0000-000000000000",
    )
    with pytest.raises(ValueError, match="order_not_found"):
        await TransactionService.create_transaction(session, wholesaler_id, body)


@pytest.mark.asyncio
async def test_upload_attachment_transaction_not_found_returns_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """upload_attachment when transaction not found returns None."""
    from services import transaction_service as mod

    async def mock_get_by_id(session, txn_id, wid):
        return None

    monkeypatch.setattr(
        mod.TransactionRepository,
        "get_by_id",
        AsyncMock(side_effect=mock_get_by_id),
    )
    result = await TransactionService.upload_attachment(
        AsyncMock(), "txn-id", "wid", b"content", "file.pdf", "/tmp"
    )
    assert result is None

