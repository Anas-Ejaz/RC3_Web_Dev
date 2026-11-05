"""Application, assessment, notes, audit and comparison schemas (contract objects)."""
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ApplicationStatus, EvidenceState
from app.schemas.candidate import ClaimOut, ParsedResumeOut, SkillIn


class ScorePart(BaseModel):
    score: float
    weight: float


class Breakdown(BaseModel):
    skills: ScorePart
    experience: ScorePart
    projects: ScorePart
    qualifications: ScorePart


class SkillResultOut(BaseModel):
    skill: str
    importance: int
    required: bool
    state: EvidenceState
    similarity: float
    evidence_excerpt: str | None = None


class AssessmentOut(BaseModel):
    overall_score: float
    overridden: bool = False
    override_score: float | None = None
    override_reason: str | None = None
    breakdown: Breakdown
    skill_results: list[SkillResultOut]
    gaps: list[str]
    learning_suggestions: list[str]
    explanation: str
    unsupported_claims: list[ClaimOut]
    generated_at: datetime


class ApplicationOut(BaseModel):
    id: int
    job_id: int
    job_title: str = ""  # extra field (not in contract): saves the frontend a lookup
    candidate_id: int
    candidate_name: str
    status: ApplicationStatus
    assessment: AssessmentOut | None = None
    submitted_at: datetime
    updated_at: datetime


class StatusIn(BaseModel):
    to_status: ApplicationStatus
    reason: str | None = Field(default=None, max_length=1000)


class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)

    @field_validator("text")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be blank")
        return v


class NoteOut(BaseModel):
    id: int
    text: str
    author: str
    created_at: datetime


class AuditOut(BaseModel):
    from_status: str | None
    to_status: str
    changed_by: str
    reason: str | None
    created_at: datetime


class ApplicationDetailOut(BaseModel):
    application: ApplicationOut
    resume: ParsedResumeOut
    assessment: AssessmentOut | None
    notes: list[NoteOut]
    audit: list[AuditOut]


class SkillsIn(BaseModel):
    skills: list[SkillIn] = Field(max_length=100)


class OverrideIn(BaseModel):
    score: float = Field(ge=0, le=100)
    reason: str = Field(min_length=3, max_length=1000)


class CompareIn(BaseModel):
    application_ids: list[int] = Field(min_length=2, max_length=4)

    @field_validator("application_ids")
    @classmethod
    def _unique(cls, v: list[int]) -> list[int]:
        if len(set(v)) != len(v):
            raise ValueError("application_ids must be unique")
        return v


class CompareOut(BaseModel):
    application_id: int
    candidate_name: str
    assessment: AssessmentOut | None
    key_evidence: list[str]
    missing_info: list[str]