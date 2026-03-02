"""Data access for Contact entities (wholesaler-scoped)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Contact


class ContactRepository:
    """Repository for Contact CRUD scoped by wholesaler_id."""

    @staticmethod
    async def list_by_wholesaler(
        session: AsyncSession,
        wholesaler_id: str,
        *,
        type_filter: str | None = None,
    ) -> list[Contact]:
        """List contacts for a wholesaler, optionally filtered by type (customer/supplier)."""
        q = select(Contact).where(Contact.wholesaler_id == wholesaler_id).order_by(Contact.name)
        if type_filter is not None and type_filter in ("customer", "supplier"):
            q = q.where(Contact.type == type_filter)
        result = await session.execute(q)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(
        session: AsyncSession,
        contact_id: str,
        wholesaler_id: str,
    ) -> Contact | None:
        """Get a contact by id if it belongs to the given wholesaler."""
        result = await session.execute(
            select(Contact).where(
                Contact.id == contact_id,
                Contact.wholesaler_id == wholesaler_id,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, contact: Contact) -> Contact:
        """Persist a new contact."""
        session.add(contact)
        await session.flush()
        await session.refresh(contact)
        return contact

    @staticmethod
    async def update(session: AsyncSession, contact: Contact) -> Contact:
        """Persist changes to an existing contact."""
        await session.flush()
        await session.refresh(contact)
        return contact
