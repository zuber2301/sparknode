"""add missing redemption columns

Revision ID: b1c2d3e4f5a6
Revises: a3f1c2d4e5b6
Create Date: 2026-02-05 00:00:00.000000

"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a3f1c2d4e5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- redemptions: add columns present in ORM model but missing from table --
    op.add_column('redemptions',
        sa.Column('reward_type', sa.String(50), nullable=True, server_default='voucher')
    )
    op.add_column('redemptions',
        sa.Column('otp_code', sa.String(10), nullable=True)
    )
    op.add_column('redemptions',
        sa.Column('otp_expires_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column('redemptions',
        sa.Column('delivery_details', postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('redemptions', 'delivery_details')
    op.drop_column('redemptions', 'otp_expires_at')
    op.drop_column('redemptions', 'otp_code')
    op.drop_column('redemptions', 'reward_type')
