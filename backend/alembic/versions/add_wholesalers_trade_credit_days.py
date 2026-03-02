"""add trade_credit_days to wholesalers

Revision ID: 005_trade_credit_days
Revises: 004_txn_type
Create Date: 2026-02-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '005_trade_credit_days'
down_revision: Union[str, None] = '004_txn_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'wholesalers',
        sa.Column('trade_credit_days', sa.Integer(), nullable=False, server_default=sa.text('30')),
    )


def downgrade() -> None:
    op.drop_column('wholesalers', 'trade_credit_days')
