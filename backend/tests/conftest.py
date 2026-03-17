"""Shared pytest fixtures for FastAPI backend tests.

These fixtures provide:
- Dedicated test DB (TEST_DATABASE_URL required), schema creation, and truncate-before-seed lifecycle
- Async test database and SQLAlchemy session
- FastAPI AsyncClient with dependency overrides (get_db, auth)
- Convenience auth header fixture for JWT-protected endpoints
- Optional mocks for external services such as SMS providers
"""

from collections.abc import AsyncGenerator
from typing import Any, Callable

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.main import app
from app.dependencies import get_current_user, get_current_wholesaler_id, get_db
from core.security import create_access_token
from db.base import Base
from db.models import User, Wholesaler
from services import sms as sms_module

# Patch SMS where it is used (auth router imports get_sms_provider at load time)
try:
    from api import v1 as api_v1
    _auth_module = api_v1.auth
except ImportError:
    _auth_module = None

TEST_DATABASE_URL = getattr(settings, "TEST_DATABASE_URL", None) or settings.TEST_DATABASE_URL
if not TEST_DATABASE_URL:
    pytest.exit(
        "Set TEST_DATABASE_URL to a dedicated test database (e.g. postgresql+asyncpg://user:pass@host:5432/kanaka_dhara_test) "
        "so tests do not touch the app DB.",
        returncode=2,
    )


@pytest_asyncio.fixture
async def _test_engine() -> AsyncGenerator[Any, None]:
    """Create an engine in the current event loop; dispose after test to avoid closed-loop errors."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
    )
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def test_session_and_wholesaler_id(
    _test_engine: Any,
) -> AsyncGenerator[tuple[AsyncSession, str], None]:
    """Create schema (idempotent), truncate all tables, then create a test user and wholesaler; yield (session, wholesaler_id)."""
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=_test_engine,
        expire_on_commit=False,
        class_=AsyncSession,
    )
    async with session_factory() as session:
        tables = list(Base.metadata.tables.keys())
        if tables:
            await session.execute(
                text("TRUNCATE {} RESTART IDENTITY CASCADE".format(", ".join(tables)))
            )
            await session.commit()

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


@pytest.fixture
def wholesaler_id(test_session_and_wholesaler_id: tuple[AsyncSession, str]) -> str:
    """Expose the seeded wholesaler_id separately for tests that need it."""
    _, wid = test_session_and_wholesaler_id
    return wid


@pytest_asyncio.fixture
async def api_client_user_no_wholesaler(
    test_session_and_wholesaler_id: tuple[AsyncSession, str],
) -> AsyncGenerator[AsyncClient, None]:
    """Client with user that has no wholesaler; requests to /contacts etc. get 403."""
    session, _ = test_session_and_wholesaler_id
    user2 = User(phone="+919999999999")
    session.add(user2)
    await session.commit()
    await session.refresh(user2)
    token = create_access_token(subject=str(user2.id), wholesaler_id=None)

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    async def override_get_current_user() -> dict:
        return {"sub": str(user2.id)}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    # do NOT override get_current_wholesaler_id so 403 is returned

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(wholesaler_id: str) -> dict[str, str]:
    """Return Authorization header with a valid access token for the seeded wholesaler."""
    token = create_access_token(subject="user-1", wholesaler_id=wholesaler_id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def fake_sms_provider(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """Monkeypatch get_sms_provider so the auth router uses a fake provider that records sent messages."""
    sent_messages: list[dict[str, Any]] = []

    class _FakeProvider:
        async def send_sms(self, to: str, message: str) -> None:
            sent_messages.append({"to": to, "message": message})

    def _get_fake_provider() -> Any:
        return _FakeProvider()

    monkeypatch.setattr(sms_module, "get_sms_provider", _get_fake_provider)
    if _auth_module is not None:
        monkeypatch.setattr(_auth_module, "get_sms_provider", _get_fake_provider)
    return sent_messages

