"""Candidate profile and parsed-resume schemas (contract: ParsedResume)."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

EditedBy = Literal["ai", "candidate", "recruiter"]
ParseStatus = Literal["pending", "parsed", "failed", "empty", "unsupported"]


# ---------- profile ----------
class ProfileIn(BaseModel):
    headline: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=50)
    location: str = Field(default="", max_length=200)
    interests: list[str] = Field(default_factory=list, max_length=30)
    summary: str = Field(default="", max_length=3000)


class ProfileOut(ProfileIn):
    model_config = ConfigDict(from_attributes=True)


# ---------- parsed resume (output) ----------
class SkillOut(BaseModel):
    name: str
    normalized_name: str
    evidence_excerpt: str = ""
    verified: bool
    edited_by: EditedBy


class EducationOut(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str | None = None
    evidence_excerpt: str = ""


class ExperienceOut(BaseModel):
    title: str = ""
    company: str = ""
    start: str | None = None
    end: str | None = None
    years: float | None = None
    summary: str = ""
    evidence_excerpt: str = ""


class ProjectOut(BaseModel):
    name: str = ""
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    evidence_excerpt: str = ""


class ClaimOut(BaseModel):
    claim: str
    reason: str


class ParsedResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parse_status: ParseStatus
    error_message: str | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    links: list[str] = Field(default_factory=list)
    skills: list[SkillOut] = Field(default_factory=list)
    education: list[EducationOut] = Field(default_factory=list)
    experience: list[ExperienceOut] = Field(default_factory=list)
    projects: list[ProjectOut] = Field(default_factory=list)
    unsupported_claims: list[ClaimOut] = Field(default_factory=list)


# ---------- corrections (input). A field left out is unchanged; a list replaces the old list. ----------
class SkillIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    evidence_excerpt: str = Field(default="", max_length=500)


class EducationIn(BaseModel):
    degree: str = Field(default="", max_length=200)
    institution: str = Field(default="", max_length=200)
    year: str | None = Field(default=None, max_length=30)
    evidence_excerpt: str = Field(default="", max_length=500)


class ExperienceIn(BaseModel):
    title: str = Field(default="", max_length=200)
    company: str = Field(default="", max_length=200)
    start: str | None = Field(default=None, max_length=30)
    end: str | None = Field(default=None, max_length=30)
    years: float | None = Field(default=None, ge=0, le=70)
    summary: str = Field(default="", max_length=2000)
    evidence_excerpt: str = Field(default="", max_length=500)


class ProjectIn(BaseModel):
    name: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=2000)
    technologies: list[str] = Field(default_factory=list, max_length=30)
    evidence_excerpt: str = Field(default="", max_length=500)


class ResumeCorrectionIn(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    links: list[str] | None = Field(default=None, max_length=10)
    skills: list[SkillIn] | None = Field(default=None, max_length=100)
    education: list[EducationIn] | None = Field(default=None, max_length=20)
    experience: list[ExperienceIn] | None = Field(default=None, max_length=20)
    projects: list[ProjectIn] | None = Field(default=None, max_length=20)