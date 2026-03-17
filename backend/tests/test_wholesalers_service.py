"""Unit tests for wholesaler API with mocked DB and create_access_token.

Covers all branches: GET 404/200, PUT update (with and without gst/pan in body), PUT create.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user, get_db
from app.main import app
from db.models import Wholesaler


def _make_mock_wholesaler(
    id: str = "wid-1",
    user_id: str = "user-123",
    shop_name: str = "Shop",
    owner_name: str = "Owner",
    mobile: str = "+919999999999",
    address: str = "Addr",
    gst_number: str | None = "GST1",
    pan_number: str | None = "PAN1",
    status: str = "active",
    trade_credit_days: int = 30,
) -> Wholesaler:
    """Build a Wholesaler instance for mocking (has all attributes needed by WholesalerResponse)."""
    w = Wholesaler(
        id=id,
        user_id=user_id,
        shop_name=shop_name,
        owner_name=owner_name,
        mobile=mobile,
        address=address,
        gst_number=gst_number,
        pan_number=pan_number,
        status=status,
        trade_credit_days=trade_credit_days,
    )
    w.created_at = datetime.now(timezone.utc)
    w.updated_at = datetime.now(timezone.utc)
    return w


@pytest.mark.asyncio
async def test_get_my_wholesaler_profile_not_found_404() -> None:
    """GET /me when DB returns no wholesaler raises 404."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none = MagicMock(return_value=None)

    async def mock_execute(statement):
        return result_mock

    mock_db = AsyncMock()
    mock_db.execute = mock_execute

    async def override_get_db():
        yield mock_db

    async def override_get_current_user():
        return {"sub": "user-123"}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.get("/api/v1/wholesalers/me")
        assert r.status_code == 404
        assert "Wholesaler profile not found" in r.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_my_wholesaler_profile_exists_200() -> None:
    """GET /me when DB returns wholesaler returns 200 and wholesaler in response."""
    wholesaler = _make_mock_wholesaler()

    result_mock = MagicMock()
    result_mock.scalar_one_or_none = MagicMock(return_value=wholesaler)

    async def mock_execute(statement):
        return result_mock

    mock_db = AsyncMock()
    mock_db.execute = mock_execute

    async def override_get_db():
        yield mock_db

    async def override_get_current_user():
        return {"sub": wholesaler.user_id}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.get("/api/v1/wholesalers/me")
        assert r.status_code == 200
        data = r.json()
        assert data["shopName"] == wholesaler.shop_name
        assert data["ownerName"] == wholesaler.owner_name
        assert data["id"] == wholesaler.id
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_put_my_wholesaler_profile_exists_updates_and_commits() -> None:
    """PUT /me when wholesaler exists: updates fields, calls commit and refresh."""
    wholesaler = _make_mock_wholesaler(shop_name="Old", owner_name="OldOwner")

    result_mock = MagicMock()
    result_mock.scalar_one_or_none = MagicMock(return_value=wholesaler)

    async def mock_execute(statement):
        return result_mock

    mock_db = AsyncMock()
    mock_db.execute = mock_execute
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def override_get_current_user():
        return {"sub": wholesaler.user_id}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.put(
                "/api/v1/wholesalers/me",
                json={
                    "shopName": "NewShop",
                    "ownerName": "NewOwner",
                    "mobile": "+919999999999",
                    "address": "NewAddr",
                    "gstNumber": "GST-NEW",
                    "panNumber": "PAN-NEW",
                    "status": "active",
                    "tradeCreditDays": 45,
                },
            )
        assert r.status_code == 200
        assert wholesaler.shop_name == "NewShop"
        assert wholesaler.owner_name == "NewOwner"
        assert wholesaler.gst_number == "GST-NEW"
        assert wholesaler.pan_number == "PAN-NEW"
        assert wholesaler.trade_credit_days == 45
        mock_db.commit.assert_awaited_once()
        mock_db.refresh.assert_awaited_once_with(wholesaler)
        data = r.json()
        assert "wholesaler" in data
        assert data["wholesaler"]["shopName"] == "NewShop"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_put_my_wholesaler_profile_exists_optional_fields_unchanged() -> None:
    """PUT /me without gstNumber/panNumber in body does not modify gst_number/pan_number."""
    wholesaler = _make_mock_wholesaler(gst_number="KEEP-GST", pan_number="KEEP-PAN")

    result_mock = MagicMock()
    result_mock.scalar_one_or_none = MagicMock(return_value=wholesaler)

    async def mock_execute(statement):
        return result_mock

    mock_db = AsyncMock()
    mock_db.execute = mock_execute
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def override_get_current_user():
        return {"sub": wholesaler.user_id}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.put(
                "/api/v1/wholesalers/me",
                json={
                    "shopName": "UpdatedShop",
                    "ownerName": "UpdatedOwner",
                    "mobile": "+919999999999",
                    "address": "UpdatedAddr",
                    "status": "active",
                    "tradeCreditDays": 30,
                },
            )
        assert r.status_code == 200
        assert wholesaler.shop_name == "UpdatedShop"
        assert wholesaler.gst_number == "KEEP-GST"
        assert wholesaler.pan_number == "KEEP-PAN"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_put_my_wholesaler_profile_creation_calls_add_commit_refresh(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PUT /me when no wholesaler: creates new, calls add/commit/refresh and create_access_token."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none = MagicMock(return_value=None)

    async def mock_execute(statement):
        return result_mock

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(side_effect=mock_execute)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.add = MagicMock()

    created_wholesaler: Wholesaler | None = None

    def capture_add(obj):
        nonlocal created_wholesaler
        created_wholesaler = obj

    mock_db.add.side_effect = capture_add

    async def mock_refresh(obj):
        if not getattr(obj, "created_at", None):
            obj.created_at = datetime.now(timezone.utc)
        if not getattr(obj, "updated_at", None):
            obj.updated_at = datetime.now(timezone.utc)
        if not getattr(obj, "id", None):
            obj.id = "new-wholesaler-id"

    mock_db.refresh = AsyncMock(side_effect=mock_refresh)

    async def override_get_db():
        yield mock_db

    async def override_get_current_user():
        return {"sub": "user-new"}

    mock_token = "mock-access-token"

    def fake_create_access_token(
        subject: str, wholesaler_id: str | None = None, **kwargs
    ) -> str:
        return mock_token

    from api.v1 import wholesalers as wholesalers_module

    monkeypatch.setattr(
        wholesalers_module, "create_access_token", fake_create_access_token
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.put(
                "/api/v1/wholesalers/me",
                json={
                    "shopName": "NewShop",
                    "ownerName": "NewOwner",
                    "mobile": "+919999999999",
                    "address": "Addr",
                    "status": "active",
                    "tradeCreditDays": 30,
                },
            )
        assert r.status_code == 200
        data = r.json()
        assert "wholesaler" in data
        assert data["access_token"] == mock_token
        assert data["token_type"] == "bearer"
        assert data["has_wholesaler"] is True
        mock_db.add.assert_called_once()
        assert created_wholesaler is not None
        assert created_wholesaler.user_id == "user-new"
        assert created_wholesaler.shop_name == "NewShop"
        mock_db.commit.assert_awaited()
        mock_db.refresh.assert_awaited_once_with(created_wholesaler)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
