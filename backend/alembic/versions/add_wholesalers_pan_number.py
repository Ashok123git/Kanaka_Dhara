"""add pan_number to wholesalers

Revision ID: 006_pan_number
Revises: 005_trade_credit_days
Create Date: 2026-02-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '006_pan_number'
down_revision: Union[str, None] = '005_trade_credit_days'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'wholesalers',
        sa.Column('pan_number', sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('wholesalers', 'pan_number')

