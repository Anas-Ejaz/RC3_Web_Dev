"""Analytics response schemas (contract: /analytics/*)."""
from pydantic import BaseModel


class OverviewOut(BaseModel):
    active_jobs: int
    total_applications: int
    shortlisted: int  # applications that were ever shortlisted (consistent with shortlist_rate)
    pending_reviews: int
    upcoming_interviews: int
    shortlist_rate: float  # percent, 0-100, one decimal
    avg_processing_days: float  # submission -> first manual recruiter action


class ByJobOut(BaseModel):
    job_id: int
    title: str
    applications: int
    shortlisted: int


class FunnelStageOut(BaseModel):
    stage: str
    count: int


class SkillGapOut(BaseModel):
    skill: str
    missing_count: int
    percentage: float  # % of assessed applications with no evidence found for this required skill