"""applications, notes, audit log

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _now(name: str) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


def upgrade() -> None:
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("resume_data", sa.JSON(), nullable=False),
        sa.Column("resume_text", sa.Text(), nullable=False),
        sa.Column("assessment", sa.JSON(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("overridden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("override_score", sa.Float(), nullable=True),
        sa.Column("override_reason", sa.Text(), nullable=True),
        _now("submitted_at"),
        _now("updated_at"),
        sa.UniqueConstraint("job_id", "candidate_id", name="uq_application_job_candidate"),
    )
    op.create_index("ix_applications_job_id", "applications", ["job_id"])
    op.create_index("ix_applications_candidate_id", "applications", ["candidate_id"])
    op.create_index("ix_applications_status", "applications", ["status"])

    op.create_table(
        "application_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        _now("created_at"),
    )
    op.create_index("ix_application_notes_application_id", "application_notes", ["application_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_status", sa.String(30), nullable=True),
        sa.Column("to_status", sa.String(30), nullable=False),
        sa.Column("changed_by", sa.String(200), nullable=False),
        sa.Column("changed_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        _now("created_at"),
    )
    op.create_index("ix_audit_logs_application_id", "audit_logs", ["application_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_application_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_application_notes_application_id", table_name="application_notes")
    op.drop_table("application_notes")
    op.drop_index("ix_applications_status", table_name="applications")
    op.drop_index("ix_applications_candidate_id", table_name="applications")
    op.drop_index("ix_applications_job_id", table_name="applications")
    op.drop_table("applications")