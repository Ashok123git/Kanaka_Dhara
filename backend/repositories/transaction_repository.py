"""Data access for Transaction and TransactionAttachment entities (wholesaler-scoped)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Transaction, TransactionAttachment


class TransactionRepository:
    """Repository for Transaction CRUD scoped by wholesaler_id."""

    @staticmethod
    async def list_by_wholesaler(
        session: AsyncSession,
        wholesaler_id: str,
        *,
        contact_id: str | None = None,
    ) -> list[Transaction]:
        """List transactions for a wholesaler, optionally filtered by contact_id."""
        q = (
            select(Transaction)
            .where(Transaction.wholesaler_id == wholesaler_id)
            .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        )
        if contact_id is not None:
            q = q.where(Transaction.contact_id == contact_id)
        result = await session.execute(q)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(
        session: AsyncSession,
        transaction_id: str,
        wholesaler_id: str,
    ) -> Transaction | None:
        """Get a transaction by id if it belongs to the given wholesaler."""
        result = await session.execute(
            select(Transaction).where(
                Transaction.id == transaction_id,
                Transaction.wholesaler_id == wholesaler_id,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, transaction: Transaction) -> Transaction:
        """Persist a new transaction."""
        session.add(transaction)
        await session.flush()
        await session.refresh(transaction)
        return transaction

    @staticmethod
    async def add_attachment(
        session: AsyncSession, attachment: TransactionAttachment
    ) -> TransactionAttachment:
        """Persist a new transaction attachment."""
        session.add(attachment)
        await session.flush()
        await session.refresh(attachment)
        return attachment

    @staticmethod
    async def list_attachments_by_transaction_id(
        session: AsyncSession, transaction_id: str
    ) -> list[TransactionAttachment]:
        """List all attachments for a transaction."""
        result = await session.execute(
            select(TransactionAttachment).where(
                TransactionAttachment.transaction_id == transaction_id
            )
        )
        return list(result.scalars().all())

    @staticmethod
    async def list_attachments_by_transaction_ids(
        session: AsyncSession, transaction_ids: list[str]
    ) -> dict[str, list[TransactionAttachment]]:
        """List attachments for many transactions. Returns dict transaction_id -> list of attachments."""
        if not transaction_ids:
            return {}
        result = await session.execute(
            select(TransactionAttachment).where(
                TransactionAttachment.transaction_id.in_(transaction_ids)
            )
        )
        attachments = list(result.scalars().all())
        out: dict[str, list[TransactionAttachment]] = {tid: [] for tid in transaction_ids}
        for a in attachments:
            out[a.transaction_id].append(a)
        return out
