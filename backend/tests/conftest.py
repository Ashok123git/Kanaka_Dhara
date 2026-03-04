"""Pytest fixtures for API tests. Uses real DB and overrides auth to a test wholesaler."""

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.main import app
from app.dependencies import get_db, get_current_wholesaler_id
from db.base import Base
from db.models import User, Wholesaler

# Use same DB URL as app; for isolated test runs use a separate test DB via env
TEST_DATABASE_URL = getattr(
    settings, "TEST_DATABASE_URL", None
) or settings.DATABASE_URL

_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    future=True,
)
_test_session_factory = async_sessionmaker(
    bind=_engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


@pytest_asyncio.fixture
async def test_session_and_wholesaler_id() -> AsyncGenerator[tuple[AsyncSession, str], None]:
    """Create tables, a test user, and wholesaler; yield session and wholesaler_id."""
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with _test_session_factory() as session:
        user = User(phone="+919876543210")
        session.add(user)
        await session.flush()
        wholesaler = Wholesaler(
            user_id=user.id,
            shop_name="Test Wholesaler",
            owner_name="Test Owner",
            mobile="+919876543210",
            address="123 Test St",
            status="active",
        )
        session.add(wholesaler)
        await session.commit()
        await session.refresh(wholesaler)
        wholesaler_id: str = wholesaler.id
        yield session, wholesaler_id


@pytest_asyncio.fixture
async def api_client(test_session_and_wholesaler_id) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client with app and overrides: test DB session and fixed wholesaler_id."""
    session, wholesaler_id = test_session_and_wholesaler_id

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_db] = override_get_db

    async def override_get_current_wholesaler_id() -> str:
        return wholesaler_id

    app.dependency_overrides[get_current_wholesaler_id] = override_get_current_wholesaler_id

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()
