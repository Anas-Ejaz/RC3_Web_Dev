"""Recommendations, talent-pool consent, talent pool, talent search and duplicate schemas."""
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.job import JobOut


class RecommendationOut(BaseModel):
    job: JobOut
    match_score: float
    matched_skills: list[str]
    reason: str


class ConsentIn(BaseModel):
    consent: bool


class ConsentOut(BaseModel):
    consent: bool
    updated_at: datetime | None = None


class PoolCandidateOut(BaseModel):
    candidate_id: int
    name: str
    match_score: float
    matched_skills: list[str]
    gaps: list[str]
    source_application_id: int
    source_job_title: str
    previous_status: str
    consent_given: bool = True  # permission flag (only consenting candidates are ever listed)
    retention_expires_at: datetime  # retention flag
    retention_days_left: int


# ---------- Phase 8b: search ----------
class SearchIn(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    job_id: int | None = Field(default=None, ge=1)
    limit: int = Field(default=10, ge=1, le=50)

    @field_validator("query")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("query is too short")
        return v


class SearchHitOut(BaseModel):
    candidate_id: int
    name: str
    score: float
    evidence_excerpts: list[str]
    matched_terms: list[str]


# ---------- Phase 8b: duplicates ----------
class DuplicatePartyOut(BaseModel):
    candidate_id: int
    name: str


class DuplicateOut(BaseModel):
    id: int
    candidate_a: DuplicatePartyOut
    candidate_b: DuplicatePartyOut
    similarity: float
    reasons: list[str]


class DuplicateStatusOut(BaseModel):
    id: int
    status: str


class MergeIn(BaseModel):
    primary_candidate_id: int = Field(ge=1)
    reason: str = Field(min_length=5, max_length=500)

    @field_validator("reason")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("reason must be at least 5 characters")
        return v


class MergeOut(BaseModel):
    moved_application_ids: list[int]
    skipped_application_ids: list[int]