"""
User model: authentication and identity only.

Strictly no business fields or wholesaler_id. Wholesalers are linked from
wholesalers.user_id → users.id (one-to-one). Users table is the identity
store; business profile lives in wholesalers.
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class User(Base):
    """
    User: id, phone (unique), created_at, updated_at only.
    One-to-one with Wholesaler via Wholesaler.user_id → User.id.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    phone: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
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

    # One-to-one: Wholesaler links to User via wholesalers.user_id
    wholesaler: Mapped["Wholesaler | None"] = relationship(
        "Wholesaler", back_populates="user", uselist=False
    )
