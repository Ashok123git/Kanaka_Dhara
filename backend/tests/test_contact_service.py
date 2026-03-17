"""Unit tests for ContactService."""

from unittest.mock import AsyncMock

import pytest

from db.models import Contact
from db.schemas import ContactCreate, ContactUpdate
from services.contact_service import ContactService


class DummyContactRepository:
    def __init__(self):
        self.created = None

    async def create(self, session, contact):
        self.created = contact
        return contact


@pytest.mark.asyncio
async def test_contact_service_create_contact_uses_wholesaler_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """ContactService.create_contact should set wholesaler_id on new contact."""
    dummy_repo = DummyContactRepository()

    from services import contact_service as contact_service_module
    from db.schemas import ContactCreate

    monkeypatch.setattr(contact_service_module, "ContactRepository", dummy_repo, raising=False)

    body = ContactCreate(
        type="customer",
        name="Tester",
        mobile="+911234567890",
        city=None,
        address=None,
        gst_number=None,
        business_type=None,
        notes=None,
    )
    session = object()
    wholesaler_id = "wh-xyz"

    contact = await ContactService.create_contact(session, wholesaler_id, body)

    assert dummy_repo.created is not None
    assert dummy_repo.created.wholesaler_id == wholesaler_id
    assert contact.wholesaler_id == wholesaler_id


# --- update_contact: not found vs success ---


@pytest.mark.asyncio
async def test_update_contact_not_found_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    """update_contact when ContactRepository.get_by_id returns None returns None; update not called."""
    from services import contact_service as contact_service_module

    get_by_id_mock = AsyncMock(return_value=None)
    update_mock = AsyncMock()

    monkeypatch.setattr(
        contact_service_module.ContactRepository, "get_by_id", get_by_id_mock
    )
    monkeypatch.setattr(
        contact_service_module.ContactRepository, "update", update_mock
    )

    session = object()
    body = ContactUpdate(name="Updated Name", address="New Address")

    result = await ContactService.update_contact(
        session, "contact-nonexistent", "wid-1", body
    )

    assert result is None
    get_by_id_mock.assert_awaited_once_with(session, "contact-nonexistent", "wid-1")
    update_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_contact_success_updates_attributes_and_calls_update(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """update_contact when contact exists: model_dump(exclude_unset=True), setattr, ContactRepository.update called."""
    from services import contact_service as contact_service_module

    contact = Contact(
        id="contact-1",
        wholesaler_id="wid-1",
        type="customer",
        name="Old Name",
        mobile="+919999999999",
        city="Mumbai",
        address="Old Address",
        gst_number=None,
        business_type=None,
        notes=None,
    )

    get_by_id_mock = AsyncMock(return_value=contact)
    update_mock = AsyncMock(return_value=contact)

    monkeypatch.setattr(
        contact_service_module.ContactRepository, "get_by_id", get_by_id_mock
    )
    monkeypatch.setattr(
        contact_service_module.ContactRepository, "update", update_mock
    )

    session = object()
    # Only name and address set → model_dump(exclude_unset=True) returns only those
    body = ContactUpdate(name="Updated Name", address="New Address")

    result = await ContactService.update_contact(session, "contact-1", "wid-1", body)

    assert result is contact
    assert contact.name == "Updated Name"
    assert contact.address == "New Address"
    get_by_id_mock.assert_awaited_once_with(session, "contact-1", "wid-1")
    update_mock.assert_awaited_once_with(session, contact)

