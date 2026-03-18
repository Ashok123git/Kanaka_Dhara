"""Unit tests for TransactionRepository."""

import pytest

from repositories.transaction_repository import TransactionRepository


@pytest.mark.asyncio
async def test_list_attachments_by_transaction_ids_empty(
    test_session_and_wholesaler_id,
) -> None:
    """Empty transaction_ids returns {} (covers early-return branch)."""
    session, _ = test_session_and_wholesaler_id
    result = await TransactionRepository.list_attachments_by_transaction_ids(
        session, []
    )
    assert result == {}
