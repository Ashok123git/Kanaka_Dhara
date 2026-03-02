"""Data access for Order entities (wholesaler-scoped)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Order


class OrderRepository:
    """Repository for Order CRUD scoped by wholesaler_id."""

    @staticmethod
    async def list_by_wholesaler(
        session: AsyncSession,
        wholesaler_id: str,
        *,
        contact_id: str | None = None,
        status_filter: str | None = None,
    ) -> list[Order]:
        """List orders for a wholesaler, optionally filtered by contact_id or status."""
        q = (
            select(Order)
            .where(Order.wholesaler_id == wholesaler_id)
            .order_by(Order.date.desc(), Order.created_at.desc())
        )
        if contact_id is not None:
            q = q.where(Order.contact_id == contact_id)
        if status_filter is not None and status_filter in ("open", "closed"):
            q = q.where(Order.status == status_filter)
        result = await session.execute(q)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(
        session: AsyncSession,
        order_id: str,
        wholesaler_id: str,
    ) -> Order | None:
        """Get an order by id if it belongs to the given wholesaler."""
        result = await session.execute(
            select(Order).where(
                Order.id == order_id,
                Order.wholesaler_id == wholesaler_id,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_wholesaler_and_order_number(
        session: AsyncSession,
        wholesaler_id: str,
        order_number: str,
    ) -> Order | None:
        """Get an order by wholesaler_id and order_number if it exists."""
        result = await session.execute(
            select(Order).where(
                Order.wholesaler_id == wholesaler_id,
                Order.order_number == order_number,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, order: Order) -> Order:
        """Persist a new order."""
        session.add(order)
        await session.flush()
        await session.refresh(order)
        return order

    @staticmethod
    async def update(session: AsyncSession, order: Order) -> Order:
        """Persist changes to an existing order."""
        await session.flush()
        await session.refresh(order)
        return order
