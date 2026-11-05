"""Job request/response schemas (contract: Job, SkillReq)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import JobStatus, JobType


class SkillReq(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    importance: int = Field(default=3, ge=1, le=5)


class JobIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    department: str = Field(default="", max_length=200)
    location: str = Field(default="", max_length=200)
    type: JobType = JobType.full_time
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=10)
    description: str = Field(default="", max_length=20000)
    required_skills: list[SkillReq] = Field(default_factory=list, max_length=50)
    preferred_skills: list[SkillReq] = Field(default_factory=list, max_length=50)
    min_experience_years: float = Field(default=0, ge=0, le=60)
    qualifications: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title must not be blank")
        return v

    @field_validator("qualifications")
    @classmethod
    def _clean_qualifications(cls, v: list[str]) -> list[str]:
        return [q.strip()[:300] for q in v if q and q.strip()]

    @model_validator(mode="after")
    def _salary_range(self) -> "JobIn":
        if self.salary_min is not None and self.salary_max is not None and self.salary_min > self.salary_max:
            raise ValueError("salary_min must not exceed salary_max")
        return self


class JobOut(JobIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: JobStatus
    applicant_count: int = 0
    created_at: datetime


class ExtractIn(BaseModel):
    description: str = Field(min_length=20, max_length=20000)


class ExtractOut(BaseModel):
    required_skills: list[SkillReq]
    preferred_skills: list[SkillReq]
    min_experience_years: float
    qualifications: list[str]