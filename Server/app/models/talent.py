"""Phase 8b tables: lazily built resume-chunk embeddings and duplicate-candidate pairs."""
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, CheckConstraint, DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import settings
from app.models.base import Base

# Single constant tied to the embedding model (BAAI/bge-small-en-v1.5 = 384). Migration 0007 freezes 384.
EMBEDDING_DIM: int = settings.embedding_dim


class ResumeChunk(Base):
    """Embedded chunk of an application's ANONYMIZED resume text. Built lazily, never during apply/assessment.

    text_hash identifies the stripped text + embedding model the chunks were built from; a different hash
    means the chunks are stale and are rebuilt on the next search or duplicate scan.
    """

    __tablename__ = "resume_chunks"
    __table_args__ = (
        Index(
            "ix_resume_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column()
    chunk_text: Mapped[str] = mapped_column(Text)
    text_hash: Mapped[str] = mapped_column(String(64))
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DuplicateCandidate(Base):
    """A suspected duplicate pair, scoped to one recruiter. candidate_a_id < candidate_b_id (enforced in code and by CHECK)."""

    __tablename__ = "duplicate_candidates"
    __table_args__ = (
        UniqueConstraint("recruiter_id", "candidate_a_id", "candidate_b_id", name="uq_duplicate_pair"),
        CheckConstraint("candidate_a_id < candidate_b_id", name="ck_duplicate_pair_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    candidate_a_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    candidate_b_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    similarity: Mapped[float] = mapped_column(Float)
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending|merged|dismissed
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())