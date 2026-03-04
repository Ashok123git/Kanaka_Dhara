"""
Wholesaler model: business profile linked to a user.

Link is enforced as wholesalers.user_id → users.id (FK + unique for one-to-one).
Users table has no wholesaler_id; this table holds the reference to the user.
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class Wholesaler(Base):
    """
    Wholesaler: one per user via user_id (FK to users.id, unique).
    Columns: id, user_id, shop_name, owner_name, mobile, address,
    gst_number (nullable), pan_number (nullable), status, trade_credit_days,
    created_at, updated_at.
    """

    __tablename__ = "wholesalers"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    shop_name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    gst_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pan_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    trade_credit_days: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("30")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship("User", back_populates="wholesaler")
