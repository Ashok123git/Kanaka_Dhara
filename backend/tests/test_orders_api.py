"""Orders API tests with realistic data."""

from decimal import Decimal

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_orders_empty(api_client: AsyncClient) -> None:
    """GET /orders returns 200 and empty list when no orders."""
    r = await api_client.get("/api/v1/orders/")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_create_order_requires_valid_contact(api_client: AsyncClient) -> None:
    """POST /orders with invalid contact_id returns 400."""
    payload = {
        "contact_id": "00000000-0000-0000-0000-000000000000",
        "order_number": "ORD-001",
        "date": "2025-02-20",
        "total_value": "15000.00",
        "status": "open",
    }
    r = await api_client.post("/api/v1/orders/", json=payload)
    assert r.status_code == 400
    assert "contact" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_and_list_order(api_client: AsyncClient) -> None:
    """Create contact, then create order; GET /orders returns it."""
    contact_payload = {
        "type": "customer",
        "name": "Bakers Corner",
        "mobile": "+919876543220",
        "city": "Pune",
    }
    cr = await api_client.post("/api/v1/contacts/", json=contact_payload)
    assert cr.status_code == 201
    contact_id = cr.json()["id"]

    order_payload = {
        "contact_id": contact_id,
        "order_number": "ORD-2025-001",
        "date": "2025-02-20",
        "total_value": "25000.50",
        "paid_amount": "10000.00",
        "returned_value": "0",
        "discount": "500.00",
        "status": "open",
    }
    r = await api_client.post("/api/v1/orders/", json=order_payload)
    assert r.status_code == 201
    data = r.json()
    assert data["order_number"] == "ORD-2025-001"
    assert data["contact_id"] == contact_id
    assert data["status"] == "open"
    assert float(data["total_value"]) == 25000.50
    order_id = data["id"]

    r2 = await api_client.get("/api/v1/orders/")
    assert r2.status_code == 200
    orders = r2.json()
    assert len(orders) == 1
    assert orders[0]["id"] == order_id


@pytest.mark.asyncio
async def test_get_order(api_client: AsyncClient) -> None:
    """Create contact and order; GET /orders/{id} returns 200."""
    cr = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "supplier", "name": "Grain Hub", "mobile": "+919876543221"},
    )
    contact_id = cr.json()["id"]
    orr = await api_client.post(
        "/api/v1/orders/",
        json={
            "contact_id": contact_id,
            "order_number": "ORD-002",
            "date": "2025-02-21",
            "total_value": "50000",
            "status": "closed",
        },
    )
    order_id = orr.json()["id"]

    r = await api_client.get(f"/api/v1/orders/{order_id}")
    assert r.status_code == 200
    assert r.json()["order_number"] == "ORD-002"
    assert r.json()["status"] == "closed"


@pytest.mark.asyncio
async def test_get_order_404(api_client: AsyncClient) -> None:
    """GET /orders/{id} with unknown id returns 404."""
    r = await api_client.get("/api/v1/orders/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_order(api_client: AsyncClient) -> None:
    """PUT /orders/{id} updates and returns 200."""
    cr = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "customer", "name": "Retail Plus", "mobile": "+919876543222"},
    )
    contact_id = cr.json()["id"]
    orr = await api_client.post(
        "/api/v1/orders/",
        json={
            "contact_id": contact_id,
            "order_number": "ORD-003",
            "date": "2025-02-22",
            "total_value": "10000",
            "status": "open",
        },
    )
    order_id = orr.json()["id"]

    update_payload = {
        "status": "closed",
        "paid_amount": "10000",
    }
    r = await api_client.put(f"/api/v1/orders/{order_id}", json=update_payload)
    assert r.status_code == 200
    assert r.json()["status"] == "closed"
    assert float(r.json()["paid_amount"]) == 10000


@pytest.mark.asyncio
async def test_update_order_404(api_client: AsyncClient) -> None:
    """PUT /orders/{id} with unknown id returns 404."""
    r = await api_client.put(
        "/api/v1/orders/00000000-0000-0000-0000-000000000000",
        json={"status": "closed"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_orders_filter_by_contact(api_client: AsyncClient) -> None:
    """GET /orders?contact_id=... returns only that contact's orders."""
    c1 = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "customer", "name": "C1", "mobile": "+919876543230"},
    )
    c2 = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "customer", "name": "C2", "mobile": "+919876543231"},
    )
    contact_id_1 = c1.json()["id"]
    contact_id_2 = c2.json()["id"]

    await api_client.post(
        "/api/v1/orders/",
        json={
            "contact_id": contact_id_1,
            "order_number": "O1",
            "date": "2025-02-23",
            "total_value": "1000",
            "status": "open",
        },
    )
    await api_client.post(
        "/api/v1/orders/",
        json={
            "contact_id": contact_id_2,
            "order_number": "O2",
            "date": "2025-02-23",
            "total_value": "2000",
            "status": "open",
        },
    )

    r = await api_client.get(f"/api/v1/orders/?contact_id={contact_id_1}")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["contact_id"] == contact_id_1
