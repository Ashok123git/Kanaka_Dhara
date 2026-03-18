"""Unit tests for OrderService business logic."""

from decimal import Decimal
from unittest.mock import AsyncMock

import pytest

from db.schemas import OrderCreate, OrderUpdate
from services.order_service import OrderService


class DummyOrderRepository:
    def __init__(self):
        self.called_with = None

    async def list_by_wholesaler(self, session, wholesaler_id, contact_id=None, status_filter=None):
        self.called_with = {
            "session": session,
            "wholesaler_id": wholesaler_id,
            "contact_id": contact_id,
            "status_filter": status_filter,
        }
        return []


@pytest.mark.asyncio
async def test_order_service_list_orders_passes_filters(monkeypatch: pytest.MonkeyPatch) -> None:
    """OrderService.list_orders should forward filters to OrderRepository."""
    dummy_repo = DummyOrderRepository()

    from services import order_service as order_service_module

    monkeypatch.setattr(order_service_module, "OrderRepository", dummy_repo, raising=False)

    session = object()
    wholesaler_id = "wh-1"

    # list_orders should call DummyOrderRepository.list_by_wholesaler with same filters
    await OrderService.list_orders(session, wholesaler_id, contact_id="c-1", status_filter="open")

    assert dummy_repo.called_with is not None
    assert dummy_repo.called_with["wholesaler_id"] == wholesaler_id
    assert dummy_repo.called_with["contact_id"] == "c-1"
    assert dummy_repo.called_with["status_filter"] == "open"


# --- create_order: contact validation, duplicate check, success ---


@pytest.mark.asyncio
async def test_create_order_contact_not_found_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_order when ContactRepository.get_by_id returns None raises ValueError('contact_not_found')."""
    from services import order_service as order_service_module

    get_by_id_mock = AsyncMock(return_value=None)
    get_by_wholesaler_mock = AsyncMock(return_value=None)
    create_mock = AsyncMock()

    monkeypatch.setattr(
        order_service_module.ContactRepository, "get_by_id", get_by_id_mock
    )
    monkeypatch.setattr(
        order_service_module.OrderRepository,
        "get_by_wholesaler_and_order_number",
        get_by_wholesaler_mock,
    )
    monkeypatch.setattr(order_service_module.OrderRepository, "create", create_mock)

    session = object()
    body = OrderCreate(
        contact_id="contact-1",
        order_number="ORD-001",
        date="2025-03-01",
        total_value=Decimal("100"),
        status="open",
    )

    with pytest.raises(ValueError, match="contact_not_found"):
        await OrderService.create_order(session, "wid-1", body)

    get_by_id_mock.assert_awaited_once_with(session, "contact-1", "wid-1")
    get_by_wholesaler_mock.assert_not_awaited()
    create_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_order_duplicate_order_number_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_order when OrderRepository.get_by_wholesaler_and_order_number returns existing raises ValueError('order_number_duplicate')."""
    from services import order_service as order_service_module

    mock_contact = object()
    existing_order = object()

    get_by_id_mock = AsyncMock(return_value=mock_contact)
    get_by_wholesaler_mock = AsyncMock(return_value=existing_order)
    create_mock = AsyncMock()

    monkeypatch.setattr(
        order_service_module.ContactRepository, "get_by_id", get_by_id_mock
    )
    monkeypatch.setattr(
        order_service_module.OrderRepository,
        "get_by_wholesaler_and_order_number",
        get_by_wholesaler_mock,
    )
    monkeypatch.setattr(order_service_module.OrderRepository, "create", create_mock)

    session = object()
    body = OrderCreate(
        contact_id="contact-1",
        order_number="ORD-DUP",
        date="2025-03-01",
        total_value=Decimal("100"),
        status="open",
    )

    with pytest.raises(ValueError, match="order_number_duplicate"):
        await OrderService.create_order(session, "wid-1", body)

    get_by_id_mock.assert_awaited_once()
    get_by_wholesaler_mock.assert_awaited_once_with(session, "wid-1", "ORD-DUP")
    create_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_order_success_calls_repository_create(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_order when contact exists and no duplicate: builds Order and calls OrderRepository.create."""
    from services import order_service as order_service_module

    from db.models import Order

    mock_contact = object()
    created_order = Order(
        contact_id="contact-1",
        wholesaler_id="wid-1",
        order_number="ORD-NEW",
        date="2025-03-01",
        total_value=Decimal("200"),
        paid_amount=Decimal("0"),
        returned_value=Decimal("0"),
        discount=Decimal("0"),
        status="open",
    )
    created_order.id = "order-new-id"

    get_by_id_mock = AsyncMock(return_value=mock_contact)
    get_by_wholesaler_mock = AsyncMock(return_value=None)
    create_mock = AsyncMock(return_value=created_order)

    monkeypatch.setattr(
        order_service_module.ContactRepository, "get_by_id", get_by_id_mock
    )
    monkeypatch.setattr(
        order_service_module.OrderRepository,
        "get_by_wholesaler_and_order_number",
        get_by_wholesaler_mock,
    )
    monkeypatch.setattr(order_service_module.OrderRepository, "create", create_mock)

    session = object()
    body = OrderCreate(
        contact_id="contact-1",
        order_number="ORD-NEW",
        date="2025-03-01",
        total_value=Decimal("200"),
        status="open",
    )

    result = await OrderService.create_order(session, "wid-1", body)

    assert result is created_order
    get_by_id_mock.assert_awaited_once_with(session, "contact-1", "wid-1")
    get_by_wholesaler_mock.assert_awaited_once_with(session, "wid-1", "ORD-NEW")
    create_mock.assert_awaited_once()
    call_args = create_mock.call_args
    order_passed = call_args[0][1]
    assert order_passed.contact_id == "contact-1"
    assert order_passed.wholesaler_id == "wid-1"
    assert order_passed.order_number == "ORD-NEW"
    assert order_passed.total_value == Decimal("200")
    assert order_passed.status == "open"


# --- update_order: order not found, invalid contact, success ---


@pytest.mark.asyncio
async def test_update_order_not_found_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    """update_order when OrderRepository.get_by_id returns None returns None."""
    from services import order_service as order_service_module

    get_by_id_mock = AsyncMock(return_value=None)
    update_mock = AsyncMock()

    monkeypatch.setattr(
        order_service_module.OrderRepository, "get_by_id", get_by_id_mock
    )
    monkeypatch.setattr(order_service_module.OrderRepository, "update", update_mock)

    session = object()
    body = OrderUpdate(status="closed")

    result = await OrderService.update_order(session, "order-1", "wid-1", body)

    assert result is None
    get_by_id_mock.assert_awaited_once_with(session, "order-1", "wid-1")
    update_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_order_invalid_contact_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """update_order when contact_id in body and ContactRepository.get_by_id returns None raises ValueError('contact_not_found')."""
    from services import order_service as order_service_module

    from db.models import Order

    existing_order = Order(
        contact_id="old-contact",
        wholesaler_id="wid-1",
        order_number="ORD-1",
        date="2025-03-01",
        total_value=Decimal("100"),
        status="open",
    )
    existing_order.id = "order-1"

    get_order_mock = AsyncMock(return_value=existing_order)
    get_contact_mock = AsyncMock(return_value=None)
    update_mock = AsyncMock()

    monkeypatch.setattr(
        order_service_module.OrderRepository, "get_by_id", get_order_mock
    )
    monkeypatch.setattr(
        order_service_module.ContactRepository, "get_by_id", get_contact_mock
    )
    monkeypatch.setattr(order_service_module.OrderRepository, "update", update_mock)

    session = object()
    body = OrderUpdate(contact_id="invalid-contact", status="closed")

    with pytest.raises(ValueError, match="contact_not_found"):
        await OrderService.update_order(session, "order-1", "wid-1", body)

    get_contact_mock.assert_awaited_once_with(session, "invalid-contact", "wid-1")
    update_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_order_success_updates_attributes_and_calls_update(monkeypatch: pytest.MonkeyPatch) -> None:
    """update_order when order exists: setattr applied and OrderRepository.update called."""
    from services import order_service as order_service_module

    from db.models import Order

    existing_order = Order(
        contact_id="old-contact",
        wholesaler_id="wid-1",
        order_number="ORD-1",
        date="2025-03-01",
        total_value=Decimal("100"),
        status="open",
    )
    existing_order.id = "order-1"

    get_order_mock = AsyncMock(return_value=existing_order)
    update_mock = AsyncMock(return_value=existing_order)

    monkeypatch.setattr(
        order_service_module.OrderRepository, "get_by_id", get_order_mock
    )
    monkeypatch.setattr(order_service_module.OrderRepository, "update", update_mock)

    session = object()
    body = OrderUpdate(status="closed", total_value=Decimal("150"))

    result = await OrderService.update_order(session, "order-1", "wid-1", body)

    assert result is existing_order
    assert existing_order.status == "closed"
    assert existing_order.total_value == Decimal("150")
    update_mock.assert_awaited_once_with(session, existing_order)


@pytest.mark.asyncio
async def test_update_order_success_with_contact_id_valid_contact(monkeypatch: pytest.MonkeyPatch) -> None:
    """update_order with contact_id in body and valid contact: contact checked, then setattr and update."""
    from services import order_service as order_service_module

    from db.models import Order

    existing_order = Order(
        contact_id="old-contact",
        wholesaler_id="wid-1",
        order_number="ORD-1",
        date="2025-03-01",
        total_value=Decimal("100"),
        status="open",
    )
    existing_order.id = "order-1"
    mock_contact = object()

    get_order_mock = AsyncMock(return_value=existing_order)
    get_contact_mock = AsyncMock(return_value=mock_contact)
    update_mock = AsyncMock(return_value=existing_order)

    monkeypatch.setattr(
        order_service_module.OrderRepository, "get_by_id", get_order_mock
    )
    monkeypatch.setattr(
        order_service_module.ContactRepository, "get_by_id", get_contact_mock
    )
    monkeypatch.setattr(order_service_module.OrderRepository, "update", update_mock)

    session = object()
    body = OrderUpdate(contact_id="new-contact-1", status="closed")

    result = await OrderService.update_order(session, "order-1", "wid-1", body)

    assert result is existing_order
    get_contact_mock.assert_awaited_once_with(session, "new-contact-1", "wid-1")
    assert existing_order.contact_id == "new-contact-1"
    assert existing_order.status == "closed"
    update_mock.assert_awaited_once()

