"""Wholesalers API tests for /wholesalers/me endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import dependencies
from core.security import create_access_token
from db.models import User, Wholesaler


@pytest.mark.asyncio
async def test_get_my_wholesaler_unauthorized(api_client: AsyncClient) -> None:
    """GET /wholesalers/me without Authorization should return 401."""
    r = await api_client.get("/api/v1/wholesalers/me")
    assert r.status_code == 401
    assert "Not authenticated" in r.json()["detail"]


@pytest.mark.asyncio
async def test_get_my_wholesaler_success(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """Override get_current_user to return the seeded user and fetch profile."""
    session, wholesaler_id = test_session_and_wholesaler_id

    # Look up the seeded wholesaler and its user_id
    result = await session.execute(select(Wholesaler).where(Wholesaler.id == wholesaler_id))
    wholesaler = result.scalar_one()

    async def override_get_current_user():
        return {"sub": str(wholesaler.user_id)}

    from app.main import app

    app.dependency_overrides[dependencies.get_current_user] = override_get_current_user

    r = await api_client.get("/api/v1/wholesalers/me")
    assert r.status_code == 200
    data = r.json()
    # Response serializes using camelCase aliases
    assert data["shopName"] == wholesaler.shop_name
    assert data["ownerName"] == wholesaler.owner_name

    app.dependency_overrides.pop(dependencies.get_current_user, None)


@pytest.mark.asyncio
async def test_get_my_wholesaler_404_no_profile(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    session, _ = test_session_and_wholesaler_id
    user2 = User(phone="+919999999998")
    session.add(user2)
    await session.commit()
    await session.refresh(user2)

    async def override_get_current_user():
        return {"sub": str(user2.id)}

    from app.main import app

    app.dependency_overrides[dependencies.get_current_user] = override_get_current_user
    r = await api_client.get("/api/v1/wholesalers/me")
    assert r.status_code == 404
    app.dependency_overrides.pop(dependencies.get_current_user, None)


@pytest.mark.asyncio
async def test_put_my_wholesaler_create_new_profile_201(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    session, _ = test_session_and_wholesaler_id
    user2 = User(phone="+919999999997")
    session.add(user2)
    await session.commit()
    await session.refresh(user2)

    async def override_get_current_user():
        return {"sub": str(user2.id)}

    from app.main import app

    app.dependency_overrides[dependencies.get_current_user] = override_get_current_user
    payload = {
        "shopName": "New Shop",
        "ownerName": "Owner",
        "mobile": "+919999999997",
        "address": "Addr",
        "status": "active",
        "tradeCreditDays": 30,
    }
    r = await api_client.put("/api/v1/wholesalers/me", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "wholesaler" in data
    assert "access_token" in data
    app.dependency_overrides.pop(dependencies.get_current_user, None)


@pytest.mark.asyncio
async def test_put_my_wholesaler_422_validation(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    session, wid = test_session_and_wholesaler_id
    result = await session.execute(select(Wholesaler).where(Wholesaler.id == wid))
    w = result.scalar_one()
    token = create_access_token(subject=str(w.user_id), wholesaler_id=wid)
    headers = {"Authorization": f"Bearer {token}"}
    r = await api_client.put(
        "/api/v1/wholesalers/me",
        json={
            "shopName": "",
            "ownerName": "O",
            "mobile": "+91",
            "address": "A",
            "status": "active",
            "tradeCreditDays": 0,
        },
        headers=headers,
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_get_my_wholesaler_401_invalid_token(api_client: AsyncClient) -> None:
    r = await api_client.get(
        "/api/v1/wholesalers/me",
        headers={"Authorization": "Bearer invalid.jwt.here"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_get_my_wholesaler_401_token_missing_sub(api_client: AsyncClient) -> None:
    """GET /wholesalers/me when token has no sub returns 401."""
    from app.main import app

    async def override_get_current_user():
        return {}

    app.dependency_overrides[dependencies.get_current_user] = override_get_current_user
    try:
        r = await api_client.get("/api/v1/wholesalers/me")
        assert r.status_code == 401
        assert "Invalid token" in r.json()["detail"]
    finally:
        app.dependency_overrides.pop(dependencies.get_current_user, None)


@pytest.mark.asyncio
async def test_put_my_wholesaler_401_token_missing_sub(api_client: AsyncClient) -> None:
    """PUT /wholesalers/me when token has no sub returns 401."""
    from app.main import app

    async def override_get_current_user():
        return {}

    app.dependency_overrides[dependencies.get_current_user] = override_get_current_user
    try:
        r = await api_client.put(
            "/api/v1/wholesalers/me",
            json={
                "shopName": "S",
                "ownerName": "O",
                "mobile": "+919999999999",
                "address": "A",
                "status": "active",
                "tradeCreditDays": 30,
            },
        )
        assert r.status_code == 401
        assert "Invalid token" in r.json()["detail"]
    finally:
        app.dependency_overrides.pop(dependencies.get_current_user, None)


@pytest.mark.asyncio
async def test_put_my_wholesaler_update_with_gst_and_pan(
    api_client: AsyncClient,
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> None:
    """PUT /wholesalers/me with gstNumber and panNumber updates both (model_fields_set)."""
    session, wid = test_session_and_wholesaler_id
    result = await session.execute(select(Wholesaler).where(Wholesaler.id == wid))
    w = result.scalar_one()
    token = create_access_token(subject=str(w.user_id), wholesaler_id=wid)
    headers = {"Authorization": f"Bearer {token}"}
    r = await api_client.put(
        "/api/v1/wholesalers/me",
        json={
            "shopName": w.shop_name,
            "ownerName": w.owner_name,
            "mobile": w.mobile,
            "address": w.address,
            "gstNumber": "27AABCU9603R1ZM",
            "panNumber": "ABCDE1234F",
            "status": "active",
            "tradeCreditDays": 30,
        },
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()["wholesaler"]
    assert data.get("gstNumber") == "27AABCU9603R1ZM"
    assert data.get("panNumber") == "ABCDE1234F"

