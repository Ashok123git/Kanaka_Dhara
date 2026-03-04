"""add unique order_number per wholesaler

Revision ID: 003_orders_uq
Revises: ba572d291d58
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '003_orders_uq'
down_revision: Union[str, None] = 'ba572d291d58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_orders_wholesaler_order_number',
        'orders',
        ['wholesaler_id', 'order_number'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'uq_orders_wholesaler_order_number',
        'orders',
        type_='unique',
    )
