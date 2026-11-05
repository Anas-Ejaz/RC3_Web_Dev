"""talent pool consent columns on candidate_profiles

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "candidate_profiles",
        sa.Column("talent_pool_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "candidate_profiles",
        sa.Column("talent_pool_consent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("candidate_profiles", "talent_pool_consent_at")
    op.drop_column("candidate_profiles", "talent_pool_consent")