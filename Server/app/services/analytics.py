"""Recruiter analytics. Everything is scoped to jobs the logged-in recruiter owns.

Definitions (kept explicit so the dashboard numbers are explainable):
  - funnel / shortlisted: count of applications that EVER reached a stage, read from the audit trail,
    so an application that moved on (e.g. shortlisted -> interview) still counts as shortlisted.
  - pending_reviews: applications still waiting for a recruiter decision.
  - avg_processing_days: average time from submission to the first manual recruiter action
    (status change or similar; automatic "system" steps and score overrides are ignored).
  - skill gaps: required skills with state no_evidence_found, as a share of assessed applications.
    This reports missing EVIDENCE, never a claim that a candidate lacks the skill.
"""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.application import Application, AuditLog
from app.models.interview import Interview
from app.models.job import Job
from app.models.user import User
from app.schemas.analytics import ByJobOut, FunnelStageOut, OverviewOut, SkillGapOut

FUNNEL_STAGES = ["submitted", "ai_assessment_available", "shortlisted", "interview", "selected"]
PENDING = ("submitted", "parsed", "ai_assessment_available", "recruiter_review")


def _scope(user: User, job_id: int | None = None):
    """Application ids the recruiter owns (optionally for one job; the router verifies job ownership)."""
    stmt = select(Application.id).join(Job, Job.id == Application.job_id).where(Job.recruiter_id == user.id)
    if job_id is not None:
        stmt = stmt.where(Application.job_id == job_id)
    return stmt


def _reached(db: Session, scope) -> dict[str, int]:
    rows = db.execute(
        select(AuditLog.to_status, func.count(func.distinct(AuditLog.application_id)))
        .where(AuditLog.application_id.in_(scope), AuditLog.to_status.in_(FUNNEL_STAGES))
        .group_by(AuditLog.to_status)
    ).all()
    return {stage: n for stage, n in rows}


def _avg_processing_days(db: Session, scope) -> float:
    rows = db.execute(
        select(Application.submitted_at, func.min(AuditLog.created_at))
        .join(AuditLog, AuditLog.application_id == Application.id)
        .where(
            Application.id.in_(scope),
            AuditLog.changed_by_id.is_not(None),
            AuditLog.from_status != AuditLog.to_status,  # excludes score-override rows
        )
        .group_by(Application.id, Application.submitted_at)
    ).all()
    if not rows:
        return 0.0
    days = [max(0.0, (first - submitted).total_seconds() / 86400) for submitted, first in rows]
    return round(sum(days) / len(days), 2)


def overview(db: Session, user: User) -> OverviewOut:
    scope = _scope(user)
    total = db.scalar(select(func.count()).select_from(scope.subquery())) or 0
    shortlisted = _reached(db, scope).get("shortlisted", 0)
    active_jobs = db.scalar(
        select(func.count(Job.id)).where(Job.recruiter_id == user.id, Job.status == "open")
    ) or 0
    pending = db.scalar(
        select(func.count(Application.id)).where(Application.id.in_(scope), Application.status.in_(PENDING))
    ) or 0
    # same visibility rule as GET /interviews: job owner or assigned interviewer
    upcoming = db.scalar(
        select(func.count(func.distinct(Interview.id)))
        .join(Application, Application.id == Interview.application_id)
        .join(Job, Job.id == Application.job_id)
        .where(
            Interview.status == "scheduled",
            Interview.scheduled_at >= datetime.now(timezone.utc),
            (Job.recruiter_id == user.id) | (Interview.interviewer_id == user.id),
        )
    ) or 0
    return OverviewOut(
        active_jobs=active_jobs,
        total_applications=total,
        shortlisted=shortlisted,
        pending_reviews=pending,
        upcoming_interviews=upcoming,
        shortlist_rate=round(100.0 * shortlisted / total, 1) if total else 0.0,
        avg_processing_days=_avg_processing_days(db, scope),
    )


def by_job(db: Session, user: User) -> list[ByJobOut]:
    jobs = db.execute(
        select(Job.id, Job.title).where(Job.recruiter_id == user.id).order_by(Job.created_at.desc(), Job.id.desc())
    ).all()
    if not jobs:
        return []
    counts = dict(db.execute(
        select(Application.job_id, func.count(Application.id))
        .where(Application.job_id.in_([j[0] for j in jobs])).group_by(Application.job_id)
    ).all())
    short = dict(db.execute(
        select(Application.job_id, func.count(func.distinct(AuditLog.application_id)))
        .join(AuditLog, AuditLog.application_id == Application.id)
        .where(Application.job_id.in_([j[0] for j in jobs]), AuditLog.to_status == "shortlisted")
        .group_by(Application.job_id)
    ).all())
    return [ByJobOut(job_id=jid, title=title, applications=counts.get(jid, 0), shortlisted=short.get(jid, 0))
            for jid, title in jobs]


def funnel(db: Session, user: User, job_id: int | None = None) -> list[FunnelStageOut]:
    reached = _reached(db, _scope(user, job_id))
    return [FunnelStageOut(stage=s, count=reached.get(s, 0)) for s in FUNNEL_STAGES]


def skill_gaps(db: Session, user: User, job_id: int | None = None, limit: int = 10) -> list[SkillGapOut]:
    """Most common required skills with no evidence found, across assessed applications."""
    assessments = db.scalars(select(Application.assessment).where(
        Application.id.in_(_scope(user, job_id)), Application.assessment.is_not(None))).all()
    assessed = len(assessments)
    if not assessed:
        return []
    missing: dict[str, int] = {}
    for a in assessments:
        for r in (a or {}).get("skill_results", []):
            if r.get("required") and r.get("state") == "no_evidence_found":
                missing[r["skill"]] = missing.get(r["skill"], 0) + 1
    ranked = sorted(missing.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]
    return [SkillGapOut(skill=s, missing_count=n, percentage=round(100.0 * n / assessed, 1)) for s, n in ranked]