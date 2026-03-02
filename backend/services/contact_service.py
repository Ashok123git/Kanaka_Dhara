"""Business logic for Contact operations."""

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Contact
from db.schemas import ContactCreate, ContactUpdate
from repositories.contact_repository import ContactRepository


class ContactService:
    """Service for contact CRUD with wholesaler scoping and validation."""

    @staticmethod
    async def list_contacts(
        session: AsyncSession,
        wholesaler_id: str,
        *,
        type_filter: str | None = None,
    ) -> list[Contact]:
        """List contacts for the given wholesaler."""
        return await ContactRepository.list_by_wholesaler(
            session, wholesaler_id, type_filter=type_filter
        )

    @staticmethod
    async def get_contact(
        session: AsyncSession,
        contact_id: str,
        wholesaler_id: str,
    ) -> Contact | None:
        """Get a contact by id if it belongs to the wholesaler."""
        return await ContactRepository.get_by_id(session, contact_id, wholesaler_id)

    @staticmethod
    async def create_contact(
        session: AsyncSession,
        wholesaler_id: str,
        body: ContactCreate,
    ) -> Contact:
        """Create a new contact for the wholesaler."""
        contact = Contact(
            wholesaler_id=wholesaler_id,
            type=body.type,
            name=body.name,
            mobile=body.mobile,
            city=body.city,
            address=body.address,
            gst_number=body.gst_number,
            business_type=body.business_type,
            notes=body.notes,
        )
        return await ContactRepository.create(session, contact)

    @staticmethod
    async def update_contact(
        session: AsyncSession,
        contact_id: str,
        wholesaler_id: str,
        body: ContactUpdate,
    ) -> Contact | None:
        """Update a contact; returns None if not found or not owned by wholesaler."""
        contact = await ContactRepository.get_by_id(session, contact_id, wholesaler_id)
        if not contact:
            return None
        update_data = body.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(contact, key, value)
        return await ContactRepository.update(session, contact)
