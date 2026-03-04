"""Pydantic schemas for Order API."""

import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class OrderBase(BaseModel):
    contact_id: str
    order_number: str = Field(..., min_length=1, max_length=50)
    date: datetime.date
    total_value: Decimal = Field(..., ge=0)
    paid_amount: Decimal = Field(default=Decimal("0"), ge=0)
    returned_value: Decimal = Field(default=Decimal("0"), ge=0)
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    status: str = Field(..., pattern="^(open|closed)$")


class OrderCreate(OrderBase):
    """Request body for creating an order. wholesaler_id set from JWT."""
    pass


class OrderUpdate(BaseModel):
    """Request body for partial update of order."""
    contact_id: str | None = None
    order_number: str | None = Field(None, min_length=1, max_length=50)
    date: datetime.date | None = None
    total_value: Decimal | None = Field(None, ge=0)
    paid_amount: Decimal | None = Field(None, ge=0)
    returned_value: Decimal | None = Field(None, ge=0)
    discount: Decimal | None = Field(None, ge=0)
    status: str | None = Field(None, pattern="^(open|closed)$")


class OrderResponse(BaseModel):
    id: str
    contact_id: str
    wholesaler_id: str
    order_number: str
    date: datetime.date
    total_value: Decimal
    paid_amount: Decimal
    returned_value: Decimal
    discount: Decimal
    status: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}
