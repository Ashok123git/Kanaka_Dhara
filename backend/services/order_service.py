"""Business logic for Order operations."""

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Order
from db.schemas import OrderCreate, OrderUpdate
from repositories.contact_repository import ContactRepository
from repositories.order_repository import OrderRepository


class OrderService:
    """Service for order CRUD with wholesaler scoping and contact validation."""

    @staticmethod
    async def list_orders(
        session: AsyncSession,
        wholesaler_id: str,
        *,
        contact_id: str | None = None,
        status_filter: str | None = None,
    ) -> list[Order]:
        """List orders for the given wholesaler."""
        return await OrderRepository.list_by_wholesaler(
            session,
            wholesaler_id,
            contact_id=contact_id,
            status_filter=status_filter,
        )

    @staticmethod
    async def get_order(
        session: AsyncSession,
        order_id: str,
        wholesaler_id: str,
    ) -> Order | None:
        """Get an order by id if it belongs to the wholesaler."""
        return await OrderRepository.get_by_id(session, order_id, wholesaler_id)

    @staticmethod
    async def create_order(
        session: AsyncSession,
        wholesaler_id: str,
        body: OrderCreate,
    ) -> Order:
        """
        Create an order. Raises ValueError("contact_not_found") if contact_id
        does not exist or does not belong to the wholesaler.
        """
        contact = await ContactRepository.get_by_id(
            session, body.contact_id, wholesaler_id
        )
        if not contact:
            raise ValueError("contact_not_found")
        existing = await OrderRepository.get_by_wholesaler_and_order_number(
            session, wholesaler_id, body.order_number
        )
        if existing:
            raise ValueError("order_number_duplicate")
        order = Order(
            contact_id=body.contact_id,
            wholesaler_id=wholesaler_id,
            order_number=body.order_number,
            date=body.date,
            total_value=body.total_value,
            paid_amount=body.paid_amount,
            returned_value=body.returned_value,
            discount=body.discount,
            status=body.status,
        )
        return await OrderRepository.create(session, order)

    @staticmethod
    async def update_order(
        session: AsyncSession,
        order_id: str,
        wholesaler_id: str,
        body: OrderUpdate,
    ) -> Order | None:
        """
        Update an order. Returns None if order not found or not owned.
        Raises ValueError("contact_not_found") if contact_id is updated and
        the new contact does not belong to the wholesaler.
        """
        order = await OrderRepository.get_by_id(session, order_id, wholesaler_id)
        if not order:
            return None
        update_data = body.model_dump(exclude_unset=True)
        if "contact_id" in update_data:
            contact = await ContactRepository.get_by_id(
                session, update_data["contact_id"], wholesaler_id
            )
            if not contact:
                raise ValueError("contact_not_found")
        for key, value in update_data.items():
            setattr(order, key, value)
        return await OrderRepository.update(session, order)
