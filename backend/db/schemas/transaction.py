"""Pydantic schemas for Transaction and TransactionAttachment API."""

import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# Transaction types allowed by the model (String(30)); includes app UI types
TRANSACTION_TYPE_PATTERN = "^(sale|purchase|payment|receipt|credit_note|debit_note|opening_balance|adjustment|order_received|goods_sent|payment_received|goods_returned|order_closed)$"


class TransactionBase(BaseModel):
    contact_id: str
    type: str = Field(..., pattern=TRANSACTION_TYPE_PATTERN)
    date: datetime.date
    order_id: str | None = None
    amount: Decimal = Field(..., ge=0)
    notes: str | None = None
    payment_mode: str | None = Field(None, max_length=50)


class TransactionCreate(TransactionBase):
    """Request body for creating a transaction. wholesaler_id set from JWT."""
    pass


class TransactionAttachmentInResponse(BaseModel):
    """Attachment as included in a transaction response (with url for frontend)."""
    id: str
    file_path: str | None
    url: str  # Path like /api/v1/uploads/transactions/... for frontend to use as full URL

    model_config = {"from_attributes": True}


class TransactionResponse(BaseModel):
    id: str
    contact_id: str
    wholesaler_id: str
    type: str
    date: datetime.date
    order_id: str | None
    amount: Decimal
    notes: str | None
    payment_mode: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    attachments: list[TransactionAttachmentInResponse] = []

    model_config = {"from_attributes": True}


class TransactionAttachmentResponse(BaseModel):
    id: str
    transaction_id: str
    file_path: str | None
    storage_key: str | None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}
