"""Unit tests for transactions API with mocked TransactionService, TransactionRepository, and DB.

Covers: list (empty, with transactions + attachments), create (contact_not_found,
order_not_found, generic ValueError, success), get (404, success), upload (404, success).
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_wholesaler_id, get_db
from app.main import app
from db.models import Transaction, TransactionAttachment


def _make_mock_transaction(
    id: str = "txn-1",
    contact_id: str = "contact-1",
    wholesaler_id: str = "wid-1",
    type: str = "payment_received",
    amount: Decimal = Decimal("100"),
) -> Transaction:
    txn = Transaction(
        id=id,
        contact_id=contact_id,
        wholesaler_id=wholesaler_id,
        type=type,
        date=date(2025, 3, 1),
        order_id=None,
        amount=amount,
        notes=None,
        payment_mode="upi",
    )
    txn.created_at = datetime.now(timezone.utc)
    txn.updated_at = datetime.now(timezone.utc)
    return txn


def _make_mock_attachment(
    id: str = "att-1",
    transaction_id: str = "txn-1",
    file_path: str = "transactions/txn-1/file.pdf",
) -> TransactionAttachment:
    att = TransactionAttachment(
        id=id,
        transaction_id=transaction_id,
        file_path=file_path,
        storage_key=None,
    )
    att.created_at = datetime.now(timezone.utc)
    return att


# --- List flow ---


@pytest.mark.asyncio
async def test_list_transactions_empty_returns_empty_list(monkeypatch: pytest.MonkeyPatch) -> None:
    """list_transactions when service returns empty list returns [] without calling attachment repo."""
    from api.v1 import transactions as txn_module

    list_mock = AsyncMock(return_value=[])
    monkeypatch.setattr(txn_module.TransactionService, "list_transactions", list_mock)

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
            r = await client.get("/api/v1/transactions/")
        assert r.status_code == 200
        assert r.json() == []
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_list_transactions_with_results_calls_attachment_repo(monkeypatch: pytest.MonkeyPatch) -> None:
    """list_transactions when service returns transactions calls list_attachments_by_transaction_ids and maps attachments."""
    from api.v1 import transactions as txn_module

    txn1 = _make_mock_transaction(id="txn-1", amount=Decimal("50"))
    txn2 = _make_mock_transaction(id="txn-2", amount=Decimal("75"))
    list_mock = AsyncMock(return_value=[txn1, txn2])

    att1 = _make_mock_attachment(id="att-1", transaction_id="txn-1", file_path="transactions/txn-1/a.pdf")
    list_attachments_mock = AsyncMock(
        return_value={"txn-1": [att1], "txn-2": []}
    )

    monkeypatch.setattr(txn_module.TransactionService, "list_transactions", list_mock)
    monkeypatch.setattr(
        txn_module.TransactionRepository,
        "list_attachments_by_transaction_ids",
        list_attachments_mock,
    )

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
            r = await client.get("/api/v1/transactions/")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        assert data[0]["id"] == "txn-1"
        assert len(data[0]["attachments"]) == 1
        assert data[0]["attachments"][0]["id"] == "att-1"
        assert "/api/v1/uploads/" in data[0]["attachments"][0]["url"]
        assert data[1]["attachments"] == []
        list_attachments_mock.assert_awaited_once_with(mock_db, ["txn-1", "txn-2"])
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


# --- Create flow ---


@pytest.mark.asyncio
async def test_create_transaction_contact_not_found_400(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_transaction when service raises ValueError('contact_not_found') returns 400."""
    from api.v1 import transactions as txn_module

    create_mock = AsyncMock(side_effect=ValueError("contact_not_found"))

    monkeypatch.setattr(txn_module.TransactionService, "create_transaction", create_mock)

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
                "/api/v1/transactions/",
                json={
                    "contact_id": "00000000-0000-0000-0000-000000000000",
                    "type": "payment_received",
                    "date": "2025-03-01",
                    "amount": 100,
                    "payment_mode": "upi",
                },
            )
        assert r.status_code == 400
        assert "Contact not found" in r.json()["detail"]
        mock_db.commit.assert_not_awaited()
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_create_transaction_order_not_found_400(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_transaction when service raises ValueError('order_not_found') returns 400."""
    from api.v1 import transactions as txn_module

    create_mock = AsyncMock(side_effect=ValueError("order_not_found"))

    monkeypatch.setattr(txn_module.TransactionService, "create_transaction", create_mock)

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
                "/api/v1/transactions/",
                json={
                    "contact_id": "contact-1",
                    "type": "payment_received",
                    "date": "2025-03-01",
                    "amount": 100,
                    "order_id": "00000000-0000-0000-0000-000000000000",
                    "payment_mode": "upi",
                },
            )
        assert r.status_code == 400
        assert "Order not found" in r.json()["detail"]
        mock_db.commit.assert_not_awaited()
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_create_transaction_generic_value_error_reraised(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_transaction when service raises generic ValueError re-raises (500 or exception)."""
    from api.v1 import transactions as txn_module

    create_mock = AsyncMock(side_effect=ValueError("other_error"))

    monkeypatch.setattr(txn_module.TransactionService, "create_transaction", create_mock)

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
                "/api/v1/transactions/",
                json={
                    "contact_id": "contact-1",
                    "type": "payment_received",
                    "date": "2025-03-01",
                    "amount": 100,
                    "payment_mode": "upi",
                },
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
async def test_create_transaction_success_commit_refresh_and_attachments(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_transaction success: commit, refresh, list_attachments_by_transaction_id called, response has attachments."""
    from api.v1 import transactions as txn_module

    txn = _make_mock_transaction(id="txn-new")
    create_mock = AsyncMock(return_value=txn)
    list_att_mock = AsyncMock(return_value=[])

    monkeypatch.setattr(txn_module.TransactionService, "create_transaction", create_mock)
    monkeypatch.setattr(
        txn_module.TransactionRepository,
        "list_attachments_by_transaction_id",
        list_att_mock,
    )

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
                "/api/v1/transactions/",
                json={
                    "contact_id": "contact-1",
                    "type": "payment_received",
                    "date": "2025-03-01",
                    "amount": 100,
                    "payment_mode": "upi",
                },
            )
        assert r.status_code == 201
        mock_db.commit.assert_awaited_once()
        mock_db.refresh.assert_awaited_once_with(txn)
        list_att_mock.assert_awaited_once_with(mock_db, "txn-new")
        data = r.json()
        assert data["id"] == "txn-new"
        assert "attachments" in data
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


# --- Get transaction flow ---


@pytest.mark.asyncio
async def test_get_transaction_not_found_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """get_transaction when service returns None returns 404."""
    from api.v1 import transactions as txn_module

    get_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(txn_module.TransactionService, "get_transaction", get_mock)

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
            r = await client.get("/api/v1/transactions/txn-nonexistent")
        assert r.status_code == 404
        assert "Transaction not found" in r.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_get_transaction_found_returns_with_attachments(monkeypatch: pytest.MonkeyPatch) -> None:
    """get_transaction when service returns transaction: list_attachments_by_transaction_id called, response returned."""
    from api.v1 import transactions as txn_module

    txn = _make_mock_transaction(id="txn-1")
    att = _make_mock_attachment(transaction_id="txn-1")

    get_mock = AsyncMock(return_value=txn)
    list_att_mock = AsyncMock(return_value=[att])

    monkeypatch.setattr(txn_module.TransactionService, "get_transaction", get_mock)
    monkeypatch.setattr(
        txn_module.TransactionRepository,
        "list_attachments_by_transaction_id",
        list_att_mock,
    )

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
            r = await client.get("/api/v1/transactions/txn-1")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "txn-1"
        assert len(data["attachments"]) == 1
        assert data["attachments"][0]["id"] == att.id
        list_att_mock.assert_awaited_once_with(mock_db, "txn-1")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


# --- Upload attachment flow ---


@pytest.mark.asyncio
async def test_upload_attachment_transaction_not_found_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """upload_transaction_attachment when service returns None returns 404."""
    from api.v1 import transactions as txn_module

    upload_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(txn_module.TransactionService, "upload_attachment", upload_mock)

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
                "/api/v1/transactions/txn-nonexistent/attachments",
                files={"file": ("doc.pdf", b"content", "application/pdf")},
            )
        assert r.status_code == 404
        assert "Transaction not found" in r.json()["detail"]
        mock_db.commit.assert_not_awaited()
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)


@pytest.mark.asyncio
async def test_upload_attachment_success_commit_refresh_returns_response(monkeypatch: pytest.MonkeyPatch) -> None:
    """upload_transaction_attachment when service returns attachment: commit, refresh, TransactionAttachmentResponse."""
    from api.v1 import transactions as txn_module

    att = _make_mock_attachment(id="att-new", transaction_id="txn-1", file_path="transactions/txn-1/x.pdf")
    upload_mock = AsyncMock(return_value=att)

    monkeypatch.setattr(txn_module.TransactionService, "upload_attachment", upload_mock)

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
                "/api/v1/transactions/txn-1/attachments",
                files={"file": ("doc.pdf", b"content", "application/pdf")},
            )
        assert r.status_code == 201
        data = r.json()
        assert data["id"] == "att-new"
        assert data["transaction_id"] == "txn-1"
        assert data["file_path"] == "transactions/txn-1/x.pdf"
        mock_db.commit.assert_awaited_once()
        mock_db.refresh.assert_awaited_once_with(att)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_wholesaler_id, None)
