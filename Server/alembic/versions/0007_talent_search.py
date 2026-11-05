"""pgvector, resume_chunks and duplicate_candidates

Revision ID: 0007
Revises: 0006
"""
import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

EMBEDDING_DIM = 384  # frozen: BAAI/bge-small-en-v1.5


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "resume_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("text_hash", sa.String(64), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_resume_chunks_application_id", "resume_chunks", ["application_id"])
    op.execute(
        "CREATE INDEX ix_resume_chunks_embedding_hnsw ON resume_chunks USING hnsw (embedding vector_cosine_ops)"
    )

    op.create_table(
        "duplicate_candidates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recruiter_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_a_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_b_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("similarity", sa.Float(), nullable=False),
        sa.Column("reasons", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("resolved_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("recruiter_id", "candidate_a_id", "candidate_b_id", name="uq_duplicate_pair"),
        sa.CheckConstraint("candidate_a_id < candidate_b_id", name="ck_duplicate_pair_order"),
    )
    op.create_index("ix_duplicate_candidates_recruiter_id", "duplicate_candidates", ["recruiter_id"])
    op.create_index("ix_duplicate_candidates_status", "duplicate_candidates", ["status"])


def downgrade() -> None:
    op.drop_table("duplicate_candidates")
    op.drop_table("resume_chunks")
    # The vector extension is left installed on purpose (other objects may depend on it).