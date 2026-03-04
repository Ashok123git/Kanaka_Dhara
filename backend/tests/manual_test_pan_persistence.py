import asyncio
import os

from sqlalchemy import select

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_pan.db")

from api.v1.wholesalers import upsert_my_wholesaler_profile  # noqa: E402
from db.base import Base  # noqa: E402
from db.models import User, Wholesaler  # noqa: E402
from db.schemas import WholesalerCreate  # noqa: E402
from db.session import async_session_factory, engine  # noqa: E402


async def main() -> None:
    # Ensure schema is created for the test database
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        # Create a user to own the wholesaler profile
        user = User(phone="9999999999")
        session.add(user)
        await session.commit()
        await session.refresh(user)

        # Call the upsert endpoint function with a PAN number
        body = WholesalerCreate(
            shopName="Test Shop",
            ownerName="Test Owner",
            mobile="1234567890",
            address="Test Address",
            gstNumber=None,
            status="active",
            tradeCreditDays=30,
            panNumber="ABCDE1234F",
        )

        response = await upsert_my_wholesaler_profile(
            body=body,
            user={"sub": user.id},
            db=session,
        )

        # Fetch wholesaler from DB to verify persistence
        result = await session.execute(
            select(Wholesaler).where(Wholesaler.user_id == user.id)
        )
        wholesaler = result.scalar_one()

        print("Response wholesaler:", response["wholesaler"])
        print("DB pan_number:", wholesaler.pan_number)


if __name__ == "__main__":
    asyncio.run(main())

