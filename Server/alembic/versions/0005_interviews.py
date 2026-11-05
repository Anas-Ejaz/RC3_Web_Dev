"""interview questions, interviews, feedback, notifications

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _now(name: str) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


def upgrade() -> None:
    op.create_table(
        "interview_questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("category", sa.String(10), nullable=False),
        sa.Column("answer_guideline", sa.Text(), nullable=False),
        _now("created_at"),
        _now("updated_at"),
    )
    op.create_index("ix_interview_questions_application_id", "interview_questions", ["application_id"])

    op.create_table(
        "interviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("interviewer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("location_or_link", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        _now("created_at"),
        _now("updated_at"),
    )
    op.create_index("ix_interviews_application_id", "interviews", ["application_id"])
    op.create_index("ix_interviews_interviewer_id", "interviews", ["interviewer_id"])
    op.create_index("ix_interviews_scheduled_at", "interviews", ["scheduled_at"])

    op.create_table(
        "interview_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("interview_id", sa.Integer(), sa.ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ratings", sa.JSON(), nullable=False),
        sa.Column("strengths", sa.Text(), nullable=False),
        sa.Column("concerns", sa.Text(), nullable=False),
        sa.Column("recommendation", sa.String(20), nullable=False),
        _now("created_at"),
        _now("updated_at"),
        sa.UniqueConstraint("interview_id", "author_id", name="uq_feedback_interview_author"),
    )
    op.create_index("ix_interview_feedback_interview_id", "interview_feedback", ["interview_id"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.false()),
        _now("created_at"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_interview_feedback_interview_id", table_name="interview_feedback")
    op.drop_table("interview_feedback")
    op.drop_index("ix_interviews_scheduled_at", table_name="interviews")
    op.drop_index("ix_interviews_interviewer_id", table_name="interviews")
    op.drop_index("ix_interviews_application_id", table_name="interviews")
    op.drop_table("interviews")
    op.drop_index("ix_interview_questions_application_id", table_name="interview_questions")
    op.drop_table("interview_questions")