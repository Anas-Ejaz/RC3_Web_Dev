"""enable pgvector extension

Revision ID: 0001
Revises:
Create Date: 2026-11-05
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Neon: allowed for the default role. Supabase: also works via this statement
    # (or enable "vector" under Database > Extensions in the dashboard).
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS vector")