from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status

from core.security import get_current_user
from db.session import async_session_factory


async def get_db() -> AsyncGenerator:
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_current_active_user(user=Depends(get_current_user)):
    # Placeholder for future user state checks (e.g. is_active).
    return user


async def get_current_wholesaler_id(user=Depends(get_current_user)) -> str:
    wholesaler_id = user.get("wholesaler_id") if isinstance(user, dict) else getattr(user, "wholesaler_id", None)
    if not wholesaler_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Wholesaler profile not found for user.",
        )
    return str(wholesaler_id)

