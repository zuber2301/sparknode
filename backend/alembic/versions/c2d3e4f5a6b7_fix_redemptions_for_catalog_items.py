"""fix redemptions for catalog items

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-02-05 00:01:00.000000

Changes:
- Add pending_otp to status CHECK constraint
- Make voucher_id nullable (catalog redemptions have no legacy voucher)
- Add catalog_item_id FK column (UUID, nullable) referencing reward_catalog_master
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None

_STATUSES = ['pending', 'pending_otp', 'processing', 'completed', 'failed', 'cancelled', 'expired']


def upgrade() -> None:
    # 1. Drop old status CHECK constraint and recreate with pending_otp included
    op.drop_constraint('redemptions_status_check', 'redemptions', type_='check')
    op.create_check_constraint(
        'redemptions_status_check',
        'redemptions',
        sa.text("status IN (" + ", ".join(f"'{s}'" for s in _STATUSES) + ")"),
    )

    # 2. Drop NOT NULL + FK from voucher_id so catalog items can be redeemed without
    #    a legacy voucher row.
    op.drop_constraint('redemptions_voucher_id_fkey', 'redemptions', type_='foreignkey')
    op.alter_column('redemptions', 'voucher_id', nullable=True)

    # 3. Add catalog_item_id (nullable FK → reward_catalog_master)
    op.add_column('redemptions',
        sa.Column('catalog_item_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'redemptions_catalog_item_id_fkey',
        'redemptions', 'reward_catalog_master',
        ['catalog_item_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('redemptions_catalog_item_id_fkey', 'redemptions', type_='foreignkey')
    op.drop_column('redemptions', 'catalog_item_id')

    op.alter_column('redemptions', 'voucher_id', nullable=False)
    op.create_foreign_key(
        'redemptions_voucher_id_fkey',
        'redemptions', 'vouchers',
        ['voucher_id'], ['id'],
    )

    op.drop_constraint('redemptions_status_check', 'redemptions', type_='check')
    old_statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'expired']
    op.create_check_constraint(
        'redemptions_status_check',
        'redemptions',
        sa.text("status IN (" + ", ".join(f"'{s}'" for s in old_statuses) + ")"),
    )
