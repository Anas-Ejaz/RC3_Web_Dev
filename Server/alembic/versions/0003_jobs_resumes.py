"""jobs, candidate_profiles, resumes

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts(name: str) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recruiter_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("department", sa.String(200), nullable=False),
        sa.Column("location", sa.String(200), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("salary_min", sa.Integer(), nullable=True),
        sa.Column("salary_max", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("required_skills", sa.JSON(), nullable=False),
        sa.Column("preferred_skills", sa.JSON(), nullable=False),
        sa.Column("min_experience_years", sa.Float(), nullable=False),
        sa.Column("qualifications", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_jobs_recruiter_id", "jobs", ["recruiter_id"])
    op.create_index("ix_jobs_status", "jobs", ["status"])

    op.create_table(
        "candidate_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("headline", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(50), nullable=False),
        sa.Column("location", sa.String(200), nullable=False),
        sa.Column("interests", sa.JSON(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        _ts("updated_at"),
    )
    op.create_index("ix_candidate_profiles_user_id", "candidate_profiles", ["user_id"], unique=True)

    op.create_table(
        "resumes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parse_status", sa.String(20), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("links", sa.JSON(), nullable=False),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("education", sa.JSON(), nullable=False),
        sa.Column("experience", sa.JSON(), nullable=False),
        sa.Column("projects", sa.JSON(), nullable=False),
        sa.Column("unsupported_claims", sa.JSON(), nullable=False),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_resumes_candidate_id", "resumes", ["candidate_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_resumes_candidate_id", table_name="resumes")
    op.drop_table("resumes")
    op.drop_index("ix_candidate_profiles_user_id", table_name="candidate_profiles")
    op.drop_table("candidate_profiles")
    op.drop_index("ix_jobs_status", table_name="jobs")
    op.drop_index("ix_jobs_recruiter_id", table_name="jobs")
    op.drop_table("jobs")