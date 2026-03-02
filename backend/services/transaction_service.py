"""Business logic for Transaction operations."""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Transaction, TransactionAttachment
from db.schemas import TransactionCreate
from repositories.contact_repository import ContactRepository
from repositories.order_repository import OrderRepository
from repositories.transaction_repository import TransactionRepository
from services.attachment_storage import save_transaction_attachment


def _balance_delta_for_type(txn_type: str, amount: Decimal) -> Decimal:
    """Balance delta: order_received +amount; payment_received/goods_returned/order_closed -amount; else 0."""
    if txn_type == "order_received":
        return amount
    if txn_type in ("payment_received", "goods_returned", "order_closed"):
        return -amount
    return Decimal("0")


class TransactionService:
    """Service for transaction CRUD with wholesaler scoping and contact/order validation."""

    @staticmethod
    async def list_transactions(
        session: AsyncSession,
        wholesaler_id: str,
        *,
        contact_id: str | None = None,
    ) -> list[Transaction]:
        """List transactions for the given wholesaler."""
        return await TransactionRepository.list_by_wholesaler(
            session, wholesaler_id, contact_id=contact_id
        )

    @staticmethod
    async def get_transaction(
        session: AsyncSession,
        transaction_id: str,
        wholesaler_id: str,
    ) -> Transaction | None:
        """Get a transaction by id if it belongs to the wholesaler."""
        return await TransactionRepository.get_by_id(
            session, transaction_id, wholesaler_id
        )

    @staticmethod
    async def create_transaction(
        session: AsyncSession,
        wholesaler_id: str,
        body: TransactionCreate,
    ) -> Transaction:
        """
        Create a transaction. Raises ValueError("contact_not_found") if contact_id
        does not exist or does not belong to the wholesaler. Raises
        ValueError("order_not_found") if order_id is set and the order does not
        exist or does not belong to the wholesaler/contact.
        """
        contact = await ContactRepository.get_by_id(
            session, body.contact_id, wholesaler_id
        )
        if not contact:
            raise ValueError("contact_not_found")
        if body.order_id is not None:
            order = await OrderRepository.get_by_id(
                session, body.order_id, wholesaler_id
            )
            if not order or order.contact_id != body.contact_id:
                raise ValueError("order_not_found")
        transaction = Transaction(
            contact_id=body.contact_id,
            wholesaler_id=wholesaler_id,
            type=body.type,
            date=body.date,
            order_id=body.order_id,
            amount=body.amount,
            notes=body.notes,
            payment_mode=body.payment_mode,
        )
        transaction = await TransactionRepository.create(session, transaction)

        # Update contact balance and last_activity (single source of truth)
        delta = _balance_delta_for_type(body.type, body.amount)
        contact.balance += delta
        contact.last_activity = datetime.now(timezone.utc)

        return transaction

    @staticmethod
    async def upload_attachment(
        session: AsyncSession,
        transaction_id: str,
        wholesaler_id: str,
        file_content: bytes,
        filename: str,
        upload_dir: str,
    ) -> TransactionAttachment | None:
        """
        Save file and create TransactionAttachment. Returns the attachment or None
        if transaction not found or not owned by wholesaler.
        """
        transaction = await TransactionRepository.get_by_id(
            session, transaction_id, wholesaler_id
        )
        if not transaction:
            return None
        file_path = save_transaction_attachment(
            transaction_id, file_content, filename, upload_dir
        )
        attachment = TransactionAttachment(
            transaction_id=transaction_id,
            file_path=file_path,
            storage_key=None,
        )
        return await TransactionRepository.add_attachment(session, attachment)
