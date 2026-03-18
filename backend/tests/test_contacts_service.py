"""Unit tests for contacts API with mocked ContactService and DB.

Covers: create success (commit/refresh), get 404/success, update 404/success.
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_wholesaler_id, get_db
from app.main import app
from db.models import Contact


def _make_mock_contact(
    id: str = "contact-1",
    wholesaler_id: str = "wid-1",
    type: str = "customer",
    name: str = "Test Contact",
    mobile: str | None = "+919999999999",
    city: str | None = "Mumbai",
) -> Contact:
    """Build a Contact instance for mocking (has all attributes needed by ContactResponse)."""
    c = Contact(
        id=id,
        wholesaler_id=wholesaler_id,
        type=type,
        name=name,
        mobile=mobile,
        city=city,
        address=None,
        gst_number=None,
        business_type=None,
        notes=None,
        balance=Decimal("0"),
        last_activity=None,
    )
    c.created_at = datetime.now(timezone.utc)
    c.updated_at = datetime.now(timezone.utc)
    return c


# --- Create flow ---


@pytest.mark.asyncio
async def test_create_contact_success_commit_refresh_returns_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """create_contact when ContactService.create_contact returns contact: commit, refresh, ContactResponse."""
    from api.v1 import contacts as contacts_module

    contact = _make_mock_contact(id="contact-new", name="New Contact")

    create_mock = AsyncMock(return_value=contact)
    monkeypatch.setattr(contacts_module.ContactService, "create_contact", create_mock)

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def override_wholesaler_id():
        return "wid-1"

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_wholesaler_id] = override_wholesaler_id
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.post(
                "/api/v1/contacts/",
                json={
                    "type": "customer",
                    "name": "New Contact",
                    "mobile": "+919999999999",
                    "city": "Mumbai",
                },
            )
        assert r.status_code == 201
        data = r.json()
        assert data["id"] == "contact-new"
        assert data["name"] == "New Contact"
        assert data["type"] == "customer"
        mock_db.commit.assert_awaited_once()
        mock_db.refresh.assert_awaited_once_with(contact)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


# --- Get flow ---


@pytest.mark.asyncio
async def test_get_contact_not_found_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """get_contact when ContactService.get_contact returns None raises 404."""
    from api.v1 import contacts as contacts_module

    get_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(contacts_module.ContactService, "get_contact", get_mock)

    mock_db = MagicMock()

    async def override_get_db():
        yield mock_db

    async def override_wholesaler_id():
        return "wid-1"

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_wholesaler_id] = override_wholesaler_id
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.get("/api/v1/contacts/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404
        assert "Contact not found" in r.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_get_contact_exists_returns_response(monkeypatch: pytest.MonkeyPatch) -> None:
    """get_contact when ContactService.get_contact returns contact returns ContactResponse."""
    from api.v1 import contacts as contacts_module

    contact = _make_mock_contact(id="contact-1", name="Acme Corp")

    get_mock = AsyncMock(return_value=contact)
    monkeypatch.setattr(contacts_module.ContactService, "get_contact", get_mock)

    mock_db = MagicMock()

    async def override_get_db():
        yield mock_db

    async def override_wholesaler_id():
        return "wid-1"

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_wholesaler_id] = override_wholesaler_id
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.get("/api/v1/contacts/contact-1")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "contact-1"
        assert data["name"] == "Acme Corp"
        assert data["type"] == "customer"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


# --- Update flow ---


@pytest.mark.asyncio
async def test_update_contact_not_found_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """update_contact when ContactService.update_contact returns None raises 404."""
    from api.v1 import contacts as contacts_module

    update_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(contacts_module.ContactService, "update_contact", update_mock)

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def override_wholesaler_id():
        return "wid-1"

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_wholesaler_id] = override_wholesaler_id
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.put(
                "/api/v1/contacts/00000000-0000-0000-0000-000000000000",
                json={"name": "Updated"},
            )
        assert r.status_code == 404
        assert "Contact not found" in r.json()["detail"]
        mock_db.commit.assert_not_awaited()
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_update_contact_success_commit_refresh_returns_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """update_contact when ContactService.update_contact returns contact: commit, refresh, ContactResponse."""
    from api.v1 import contacts as contacts_module

    contact = _make_mock_contact(id="contact-1", name="Updated Name")

    update_mock = AsyncMock(return_value=contact)
    monkeypatch.setattr(contacts_module.ContactService, "update_contact", update_mock)

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def override_wholesaler_id():
        return "wid-1"

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_wholesaler_id] = override_wholesaler_id
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.put(
                "/api/v1/contacts/contact-1",
                json={"name": "Updated Name"},
            )
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "contact-1"
        assert data["name"] == "Updated Name"
        mock_db.commit.assert_awaited_once()
        mock_db.refresh.assert_awaited_once_with(contact)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)
