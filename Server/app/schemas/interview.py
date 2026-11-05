"""Schemas for interview questions, interviews, feedback, decisions and notifications."""
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Difficulty = Literal["beginner", "intermediate", "advanced"]
Category = Literal["role", "project"]
InterviewType = Literal["technical", "hr", "managerial", "panel"]
Recommendation = Literal["strong_yes", "yes", "no", "strong_no"]


def _utc(v: datetime | None) -> datetime | None:
    """Treat naive datetimes as UTC; convert aware ones to UTC."""
    if v is None:
        return None
    return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v.astimezone(timezone.utc)


# ---------- questions ----------
class QuestionCounts(BaseModel):
    beginner: int = Field(default=2, ge=0, le=10)
    intermediate: int = Field(default=2, ge=0, le=10)
    advanced: int = Field(default=1, ge=0, le=10)


class GenerateIn(BaseModel):
    counts: QuestionCounts = Field(default_factory=QuestionCounts)
    include_project_questions: bool = True

    @model_validator(mode="after")
    def _something_requested(self) -> "GenerateIn":
        c = self.counts
        if c.beginner + c.intermediate + c.advanced == 0 and not self.include_project_questions:
            raise ValueError("Request at least one question")
        return self


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    difficulty: Difficulty
    category: Category
    answer_guideline: str


class QuestionUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=5, max_length=1000)
    difficulty: Difficulty | None = None
    answer_guideline: str | None = Field(default=None, max_length=3000)

    @model_validator(mode="after")
    def _any_field(self) -> "QuestionUpdate":
        if self.text is None and self.difficulty is None and self.answer_guideline is None:
            raise ValueError("Provide at least one field to update")
        return self


# ---------- interviews ----------
class InterviewerOut(BaseModel):
    id: int
    full_name: str


class InterviewIn(BaseModel):
    application_id: int
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)
    interviewer_id: int
    type: InterviewType
    location_or_link: str = Field(min_length=1, max_length=500)
    force: bool = False  # schedule despite conflicts

    @field_validator("scheduled_at")
    @classmethod
    def _tz(cls, v: datetime) -> datetime:
        return _utc(v)  # type: ignore[return-value]


class InterviewUpdate(BaseModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)
    interviewer_id: int | None = None
    type: InterviewType | None = None
    location_or_link: str | None = Field(default=None, min_length=1, max_length=500)
    status: Literal["scheduled", "cancelled"] | None = None  # "cancelled" cancels the interview
    force: bool = False

    @field_validator("scheduled_at")
    @classmethod
    def _tz(cls, v: datetime | None) -> datetime | None:
        return _utc(v)


class Ratings(BaseModel):
    technical: int = Field(ge=1, le=5)
    communication: int = Field(ge=1, le=5)
    problem_solving: int = Field(ge=1, le=5)
    culture: int = Field(ge=1, le=5)


class FeedbackIn(BaseModel):
    ratings: Ratings
    strengths: str = Field(default="", max_length=3000)
    concerns: str = Field(default="", max_length=3000)
    recommendation: Recommendation


class FeedbackOut(BaseModel):
    id: int
    author: str
    ratings: Ratings
    strengths: str
    concerns: str
    recommendation: Recommendation
    created_at: datetime


class InterviewOut(BaseModel):
    id: int
    application_id: int
    candidate_name: str
    job_title: str
    scheduled_at: datetime
    duration_minutes: int
    interviewer_id: int
    interviewer_name: str
    type: InterviewType
    location_or_link: str
    status: Literal["scheduled", "completed", "cancelled"]
    feedback: list[FeedbackOut] = Field(default_factory=list)


class DecisionIn(BaseModel):
    decision: Literal["selected", "not_selected"]
    reason: str = Field(min_length=3, max_length=1000)


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    title: str
    message: str
    read: bool
    created_at: datetime