"""expand transactions type check to allow app UI types

Revision ID: 004_txn_type
Revises: 003_orders_uq
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '004_txn_type'
down_revision: Union[str, None] = '003_orders_uq'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('transactions_type_check', 'transactions', type_='check')
    op.execute(
        "ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ("
        "'sale', 'purchase', 'payment', 'receipt', 'credit_note', 'debit_note', "
        "'opening_balance', 'adjustment', "
        "'order_received', 'goods_sent', 'payment_received', 'goods_returned', 'order_closed'"
        "))"
    )


def downgrade() -> None:
    op.drop_constraint('transactions_type_check', 'transactions', type_='check')
    op.execute(
        "ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ("
        "'sale', 'purchase', 'payment', 'receipt', 'credit_note', 'debit_note', "
        "'opening_balance', 'adjustment'"
        "))"
    )
