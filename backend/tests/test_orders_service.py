"""Unit tests for orders API with mocked OrderService and DB.

Covers all exception and conditional branches: create (contact_not_found,
order_number_duplicate, generic ValueError), get (404), update (404, contact_not_found,
generic ValueError, success with commit/refresh).
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_wholesaler_id, get_db
from app.main import app
from db.models import Order


def _make_mock_order(
    id: str = "order-1",
    contact_id: str = "contact-1",
    wholesaler_id: str = "wholesaler-1",
    order_number: str = "ORD-001",
    order_date: date | None = None,
    total_value: Decimal = Decimal("100"),
    status: str = "open",
) -> Order:
    """Build an Order instance for response validation."""
    order = Order(
        id=id,
        contact_id=contact_id,
        wholesaler_id=wholesaler_id,
        order_number=order_number,
        date=order_date or date(2025, 3, 1),
        total_value=total_value,
        paid_amount=Decimal("0"),
        returned_value=Decimal("0"),
        discount=Decimal("0"),
        status=status,
    )
    order.created_at = datetime.now(timezone.utc)
    order.updated_at = datetime.now(timezone.utc)
    return order


@pytest.mark.asyncio
async def test_create_order_contact_not_found_400(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_order when service raises ValueError('contact_not_found') returns 400."""
    from api.v1 import orders as orders_module

    async def mock_create(*args, **kwargs):
        raise ValueError("contact_not_found")

    monkeypatch.setattr(orders_module.OrderService, "create_order", mock_create)

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
                "/api/v1/orders/",
                json={
                    "contact_id": "00000000-0000-0000-0000-000000000000",
                    "order_number": "ORD-X",
                    "date": "2025-03-01",
                    "total_value": 100,
                    "status": "open",
                },
            )
        assert r.status_code == 400
        assert "Contact not found" in r.json()["detail"]
        mock_db.commit.assert_not_awaited()
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_create_order_order_number_duplicate_400(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_order when service raises ValueError('order_number_duplicate') returns 400."""
    from api.v1 import orders as orders_module

    async def mock_create(*args, **kwargs):
        raise ValueError("order_number_duplicate")

    monkeypatch.setattr(orders_module.OrderService, "create_order", mock_create)

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
                "/api/v1/orders/",
                json={
                    "contact_id": "00000000-0000-0000-0000-000000000001",
                    "order_number": "ORD-DUP",
                    "date": "2025-03-01",
                    "total_value": 100,
                    "status": "open",
                },
            )
        assert r.status_code == 400
        assert "order number already exists" in r.json()["detail"]
        mock_db.commit.assert_not_awaited()
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_create_order_generic_value_error_reraised(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_order when service raises generic ValueError re-raises (500 or exception)."""
    from api.v1 import orders as orders_module

    async def mock_create(*args, **kwargs):
        raise ValueError("something_else")

    monkeypatch.setattr(orders_module.OrderService, "create_order", mock_create)

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
                "/api/v1/orders/",
                json={
                    "contact_id": "00000000-0000-0000-0000-000000000002",
                    "order_number": "ORD-Y",
                    "date": "2025-03-01",
                    "total_value": 100,
                    "status": "open",
                },
            )
        if r.status_code == 500:
            assert True
        else:
            pytest.fail("Expected 500 or exception for generic ValueError")
    except ValueError:
        pass
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_get_order_not_found_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """get_order when service returns None returns 404."""
    from api.v1 import orders as orders_module

    async def mock_get_order(*args, **kwargs):
        return None

    monkeypatch.setattr(orders_module.OrderService, "get_order", mock_get_order)

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
            r = await client.get("/api/v1/orders/order-nonexistent")
        assert r.status_code == 404
        assert "Order not found" in r.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_update_order_not_found_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """update_order when service returns None returns 404."""
    from api.v1 import orders as orders_module

    async def mock_update_order(*args, **kwargs):
        return None

    monkeypatch.setattr(orders_module.OrderService, "update_order", mock_update_order)

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
                "/api/v1/orders/order-nonexistent",
                json={"status": "closed"},
            )
        assert r.status_code == 404
        assert "Order not found" in r.json()["detail"]
        mock_db.commit.assert_not_awaited()
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_update_order_contact_not_found_400(monkeypatch: pytest.MonkeyPatch) -> None:
    """update_order when service raises ValueError('contact_not_found') returns 400."""
    from api.v1 import orders as orders_module

    async def mock_update_order(*args, **kwargs):
        raise ValueError("contact_not_found")

    monkeypatch.setattr(orders_module.OrderService, "update_order", mock_update_order)

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
                "/api/v1/orders/order-1",
                json={
                    "contact_id": "00000000-0000-0000-0000-000000000000",
                    "status": "open",
                },
            )
        assert r.status_code == 400
        assert "Contact not found" in r.json()["detail"]
        mock_db.commit.assert_not_awaited()
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_update_order_generic_value_error_reraised(monkeypatch: pytest.MonkeyPatch) -> None:
    """update_order when service raises generic ValueError re-raises."""
    from api.v1 import orders as orders_module

    async def mock_update_order(*args, **kwargs):
        raise ValueError("other_error")

    monkeypatch.setattr(orders_module.OrderService, "update_order", mock_update_order)

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
                "/api/v1/orders/order-1",
                json={"status": "closed"},
            )
        if r.status_code == 500:
            assert True
        else:
            pytest.fail("Expected 500 for generic ValueError")
    except ValueError:
        pass
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_update_order_success_commit_refresh(monkeypatch: pytest.MonkeyPatch) -> None:
    """update_order when service returns order: commit and refresh called, 200 with OrderResponse."""
    from api.v1 import orders as orders_module

    order = _make_mock_order(id="order-1", order_number="ORD-001", status="closed")

    async def mock_update_order(*args, **kwargs):
        return order

    monkeypatch.setattr(orders_module.OrderService, "update_order", mock_update_order)

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
                "/api/v1/orders/order-1",
                json={"status": "closed"},
            )
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == order.id
        assert data["order_number"] == order.order_number
        assert data["status"] == "closed"
        mock_db.commit.assert_awaited_once()
        mock_db.refresh.assert_awaited_once_with(order)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_create_order_success_commit_refresh(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_order when service returns order: commit and refresh called, 201 with OrderResponse."""
    from api.v1 import orders as orders_module

    order = _make_mock_order(id="order-new", order_number="ORD-NEW")

    async def mock_create_order(*args, **kwargs):
        return order

    monkeypatch.setattr(orders_module.OrderService, "create_order", mock_create_order)

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
                "/api/v1/orders/",
                json={
                    "contact_id": "contact-1",
                    "order_number": "ORD-NEW",
                    "date": "2025-03-01",
                    "total_value": 100,
                    "status": "open",
                },
            )
        assert r.status_code == 201
        data = r.json()
        assert data["id"] == order.id
        assert data["order_number"] == "ORD-NEW"
        mock_db.commit.assert_awaited_once()
        mock_db.refresh.assert_awaited_once_with(order)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)
