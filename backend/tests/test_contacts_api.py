"""Contacts API tests with realistic data."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_contacts_empty(api_client: AsyncClient) -> None:
    """GET /contacts returns 200 and empty list when no contacts."""
    r = await api_client.get("/api/v1/contacts/")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_create_and_list_contact(api_client: AsyncClient) -> None:
    """POST /contacts creates a contact; GET /contacts returns it."""
    payload = {
        "type": "customer",
        "name": "Acme Traders",
        "mobile": "+919876543211",
        "city": "Mumbai",
        "address": "45 MG Road, Andheri East",
        "gst_number": "27AABCU9603R1ZM",
        "business_type": "Retail",
        "notes": "Preferred delivery before 11 AM",
    }
    r = await api_client.post("/api/v1/contacts/", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Acme Traders"
    assert data["type"] == "customer"
    assert data["city"] == "Mumbai"
    assert "id" in data
    assert "wholesaler_id" in data
    contact_id = data["id"]

    r2 = await api_client.get("/api/v1/contacts/")
    assert r2.status_code == 200
    list_data = r2.json()
    assert len(list_data) == 1
    assert list_data[0]["id"] == contact_id
    assert list_data[0]["name"] == "Acme Traders"


@pytest.mark.asyncio
async def test_get_contact(api_client: AsyncClient) -> None:
    """Create contact then GET /contacts/{id} returns 200 and same data."""
    payload = {
        "type": "supplier",
        "name": "Global Spices Co",
        "mobile": "+919876543212",
        "city": "Chennai",
    }
    r = await api_client.post("/api/v1/contacts/", json=payload)
    assert r.status_code == 201
    contact_id = r.json()["id"]

    r2 = await api_client.get(f"/api/v1/contacts/{contact_id}")
    assert r2.status_code == 200
    assert r2.json()["name"] == "Global Spices Co"
    assert r2.json()["type"] == "supplier"


@pytest.mark.asyncio
async def test_get_contact_404(api_client: AsyncClient) -> None:
    """GET /contacts/{id} with unknown id returns 404."""
    r = await api_client.get("/api/v1/contacts/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
    assert "not found" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_contact(api_client: AsyncClient) -> None:
    """PUT /contacts/{id} updates and returns 200."""
    payload = {
        "type": "customer",
        "name": "Fresh Foods Ltd",
        "mobile": "+919876543213",
    }
    r = await api_client.post("/api/v1/contacts/", json=payload)
    assert r.status_code == 201
    contact_id = r.json()["id"]

    update_payload = {
        "name": "Fresh Foods Ltd (Updated)",
        "address": "100 Park Street, Kolkata",
    }
    r2 = await api_client.put(f"/api/v1/contacts/{contact_id}", json=update_payload)
    assert r2.status_code == 200
    data = r2.json()
    assert data["name"] == "Fresh Foods Ltd (Updated)"
    assert data["address"] == "100 Park Street, Kolkata"
    assert data["mobile"] == "+919876543213"


@pytest.mark.asyncio
async def test_update_contact_404(api_client: AsyncClient) -> None:
    """PUT /contacts/{id} with unknown id returns 404."""
    r = await api_client.put(
        "/api/v1/contacts/00000000-0000-0000-0000-000000000000",
        json={"name": "Any"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_contacts_filter_by_type(api_client: AsyncClient) -> None:
    """GET /contacts?type=customer returns only customers."""
    await api_client.post(
        "/api/v1/contacts/",
        json={"type": "customer", "name": "Customer One"},
    )
    await api_client.post(
        "/api/v1/contacts/",
        json={"type": "supplier", "name": "Supplier One"},
    )
    r = await api_client.get("/api/v1/contacts/?type=customer")
    assert r.status_code == 200
    assert all(c["type"] == "customer" for c in r.json())
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_create_contact_422_invalid_type(api_client: AsyncClient) -> None:
    r = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "invalid", "name": "X", "mobile": "+919999999999"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_contact_422_empty_name(api_client: AsyncClient) -> None:
    r = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "customer", "name": ""},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_list_contacts_403_no_wholesaler(api_client_user_no_wholesaler: AsyncClient) -> None:
    r = await api_client_user_no_wholesaler.get("/api/v1/contacts/")
    assert r.status_code == 403
    assert "wholesaler" in r.json()["detail"].lower()
