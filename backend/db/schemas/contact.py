"""Pydantic schemas for Contact API."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ContactBase(BaseModel):
    type: str = Field(..., pattern="^(customer|supplier)$")
    name: str = Field(..., min_length=1, max_length=255)
    mobile: str | None = Field(None, max_length=20)
    city: str | None = Field(None, max_length=100)
    address: str | None = Field(None, max_length=5000)
    gst_number: str | None = Field(None, max_length=50)
    business_type: str | None = Field(None, max_length=100)
    notes: str | None = None


class ContactCreate(ContactBase):
    """Request body for creating a contact. wholesaler_id set from JWT."""
    pass


class ContactUpdate(BaseModel):
    """Request body for partial update of contact."""
    type: str | None = Field(None, pattern="^(customer|supplier)$")
    name: str | None = Field(None, min_length=1, max_length=255)
    mobile: str | None = Field(None, max_length=20)
    city: str | None = Field(None, max_length=100)
    address: str | None = Field(None, max_length=5000)
    gst_number: str | None = Field(None, max_length=50)
    business_type: str | None = Field(None, max_length=100)
    notes: str | None = None


class ContactResponse(BaseModel):
    id: str
    wholesaler_id: str
    type: str
    name: str
    mobile: str | None
    city: str | None
    address: str | None
    gst_number: str | None
    business_type: str | None
    notes: str | None
    balance: Decimal
    last_activity: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
