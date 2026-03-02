"""Pydantic schemas for Wholesaler API."""

from datetime import datetime

from pydantic import BaseModel, Field


class WholesalerBase(BaseModel):
    shop_name: str = Field(..., min_length=1, max_length=255, alias="shopName")
    owner_name: str = Field(..., min_length=1, max_length=255, alias="ownerName")
    mobile: str = Field(..., min_length=1, max_length=20)
    address: str = Field(..., max_length=5000)
    gst_number: str | None = Field(None, max_length=50, alias="gstNumber")
    pan_number: str | None = Field(None, max_length=20, alias="panNumber")
    status: str = Field(default="active", max_length=20)
    trade_credit_days: int = Field(30, ge=1, le=100, alias="tradeCreditDays")


class WholesalerCreate(WholesalerBase):
    """Request body for creating a wholesaler (e.g. after registration). Accepts camelCase from frontend."""

    model_config = {"populate_by_name": True}


class WholesalerUpdate(BaseModel):
    """Request body for partial update of wholesaler."""
    shop_name: str | None = Field(None, min_length=1, max_length=255)
    owner_name: str | None = Field(None, min_length=1, max_length=255)
    mobile: str | None = Field(None, min_length=1, max_length=20)
    address: str | None = Field(None, max_length=5000)
    gst_number: str | None = Field(None, max_length=50)
    pan_number: str | None = Field(None, max_length=20)
    status: str | None = Field(None, max_length=20)
    trade_credit_days: int | None = Field(None, ge=1, le=100, alias="tradeCreditDays")


class WholesalerResponse(BaseModel):
    id: str
    user_id: str = Field(serialization_alias="userId")
    shop_name: str = Field(serialization_alias="shopName")
    owner_name: str = Field(serialization_alias="ownerName")
    mobile: str
    address: str
    gst_number: str | None = Field(None, serialization_alias="gstNumber")
    pan_number: str | None = Field(None, serialization_alias="panNumber")
    status: str
    trade_credit_days: int = Field(serialization_alias="tradeCreditDays")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}
