"""Transactions API tests for listing and creating transactions."""

from decimal import Decimal

import pytest
from httpx import AsyncClient


def test_attachment_to_in_response_empty_path() -> None:
    """_attachment_to_in_response uses empty url when file_path is None."""
    from api.v1.transactions import _attachment_to_in_response

    class MockAttachment:
        id = "att-1"
        file_path = None

    out = _attachment_to_in_response(MockAttachment())
    assert out.url == ""
    assert out.file_path is None


@pytest.mark.asyncio
async def test_list_transactions_empty(api_client: AsyncClient) -> None:
    """GET /transactions returns 200 and empty list when no transactions."""
    r = await api_client.get("/api/v1/transactions/")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_create_transaction_contact_not_found(api_client: AsyncClient) -> None:
    """POST /transactions with invalid contact_id returns 400."""
    payload = {
        "contact_id": "00000000-0000-0000-0000-000000000000",
        "type": "payment_received",
        "date": "2025-02-20",
        "amount": "500.00",
        "notes": "Test payment",
        "payment_mode": "upi",
    }
    r = await api_client.post("/api/v1/transactions/", json=payload)
    assert r.status_code == 400
    assert "Contact not found" in r.json()["detail"]


@pytest.mark.asyncio
async def test_create_transaction_payment_success(api_client: AsyncClient) -> None:
    """Create contact then create a payment_received transaction."""
    # First create a contact
    contact_payload = {
        "type": "customer",
        "name": "Ledger Customer",
        "mobile": "+919876500000",
        "city": "Hyderabad",
    }
    cr = await api_client.post("/api/v1/contacts/", json=contact_payload)
    assert cr.status_code == 201
    contact_id = cr.json()["id"]

    txn_payload = {
        "contact_id": contact_id,
        "type": "payment_received",
        "date": "2025-02-21",
        "amount": "750.00",
        "notes": "Advance",
        "payment_mode": "cash",
        "order_id": None,
    }
    r = await api_client.post("/api/v1/transactions/", json=txn_payload)
    assert r.status_code == 201
    data = r.json()
    assert data["contact_id"] == contact_id
    assert data["type"] == "payment_received"
    assert Decimal(str(data["amount"])) == Decimal("750.00")
    # Attachments list should be present (empty by default)
    assert "attachments" in data
    assert data["attachments"] == []


@pytest.mark.asyncio
async def test_get_transaction_404(api_client: AsyncClient) -> None:
    r = await api_client.get(
        "/api/v1/transactions/00000000-0000-0000-0000-000000000000"
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_create_transaction_order_not_found_400(api_client: AsyncClient) -> None:
    cr = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "customer", "name": "C", "mobile": "+919876543250"},
    )
    cid = cr.json()["id"]
    payload = {
        "contact_id": cid,
        "type": "payment_received",
        "date": "2025-03-01",
        "amount": 100,
        "order_id": "00000000-0000-0000-0000-000000000000",
    }
    r = await api_client.post("/api/v1/transactions/", json=payload)
    assert r.status_code == 400
    assert "order" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_transaction_422_invalid_type(api_client: AsyncClient) -> None:
    cr = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "customer", "name": "C", "mobile": "+919876543251"},
    )
    r = await api_client.post(
        "/api/v1/transactions/",
        json={
            "contact_id": cr.json()["id"],
            "type": "invalid_type",
            "date": "2025-03-01",
            "amount": 100,
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_list_transactions_filter_by_contact_id(api_client: AsyncClient) -> None:
    c1 = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "customer", "name": "C1", "mobile": "+919876543252"},
    )
    c2 = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "customer", "name": "C2", "mobile": "+919876543253"},
    )
    cid1, cid2 = c1.json()["id"], c2.json()["id"]
    await api_client.post(
        "/api/v1/transactions/",
        json={
            "contact_id": cid1,
            "type": "payment_received",
            "date": "2025-03-01",
            "amount": 50,
        },
    )
    r = await api_client.get(f"/api/v1/transactions/?contact_id={cid1}")
    assert r.status_code == 200
    assert all(t["contact_id"] == cid1 for t in r.json())


@pytest.mark.asyncio
async def test_upload_attachment_201(api_client: AsyncClient) -> None:
    cr = await api_client.post(
        "/api/v1/contacts/",
        json={"type": "customer", "name": "C", "mobile": "+919876543254"},
    )
    tr = await api_client.post(
        "/api/v1/transactions/",
        json={
            "contact_id": cr.json()["id"],
            "type": "payment_received",
            "date": "2025-03-01",
            "amount": 100,
        },
    )
    tid = tr.json()["id"]
    files = {"file": ("receipt.pdf", b"pdf content", "application/pdf")}
    r = await api_client.post(
        f"/api/v1/transactions/{tid}/attachments", files=files
    )
    assert r.status_code == 201
    assert "id" in r.json() or "file_path" in r.json()


@pytest.mark.asyncio
async def test_upload_attachment_404(api_client: AsyncClient) -> None:
    files = {"file": ("x.pdf", b"x", "application/pdf")}
    r = await api_client.post(
        "/api/v1/transactions/00000000-0000-0000-0000-000000000000/attachments",
        files=files,
    )
    assert r.status_code == 404

