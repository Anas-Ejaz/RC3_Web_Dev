"""Talent pool: previously reviewed applicants of THIS recruiter who may fit another job.

Permissions and retention rules live in ONE helper, eligible_applications(), used by both the pool
and talent search so the two cannot drift apart (all enforced in the query):
  - Only the recruiter's own jobs are searched (no cross-recruiter data sharing).
  - Only candidates who currently opted in (talent_pool_consent) are listed; revoking removes them at once.
  - Only applications a human already reviewed (review, shortlisted, rejected, interview, not_selected).
  - Only applications with activity within the retention window (TALENT_POOL_RETENTION_DAYS);
    retention is measured from the application's last update.
  - If target_job_id is given, candidates who already applied to that job are left out
    (they are in that job's own list).
  - Newest application per candidate wins.
Matching in pool() uses the same computed path as assessments, with personal attributes stripped.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.application import Application
from app.models.candidate import CandidateProfile
from app.models.job import Job
from app.models.user import User
from app.schemas.talent import ConsentOut, PoolCandidateOut
from app.services import applications as apps_svc
from app.services import jobs as jobs_svc
from app.services import profiles

REVIEWED = ("recruiter_review", "shortlisted", "rejected", "interview", "not_selected")
MAX_SCANNED = 100


def retention_days() -> int:
    return int(getattr(settings, "talent_pool_retention_days", 180))


# ---------- candidate consent ----------
def get_consent(db: Session, user_id: int) -> ConsentOut:
    profile = profiles.get_profile(db, user_id)
    if profile is None:
        return ConsentOut(consent=False)
    return ConsentOut(consent=bool(profile.talent_pool_consent), updated_at=profile.talent_pool_consent_at)


def set_consent(db: Session, user_id: int, consent: bool) -> ConsentOut:
    profile = profiles.get_profile(db, user_id) or CandidateProfile(user_id=user_id)
    profile.talent_pool_consent = consent
    profile.talent_pool_consent_at = datetime.now(timezone.utc)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return ConsentOut(consent=profile.talent_pool_consent, updated_at=profile.talent_pool_consent_at)


# ---------- shared eligibility rules ----------
def eligible_applications(
    db: Session,
    recruiter_id: int,
    *,
    target_job_id: int | None = None,
    scan_limit: int = MAX_SCANNED,
) -> list[tuple[Application, str, str]]:
    """Applications that may be reused outside their own job: (application, job title, candidate name).

    Applies consent, reviewed-status, retention and ownership rules; one (newest) application per candidate.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days())
    conditions = [
        Job.recruiter_id == recruiter_id,
        Application.status.in_(REVIEWED),
        Application.updated_at >= cutoff,
        CandidateProfile.talent_pool_consent.is_(True),
    ]
    if target_job_id is not None:
        already_applied = select(Application.candidate_id).where(Application.job_id == target_job_id)
        conditions += [Application.job_id != target_job_id, Application.candidate_id.not_in(already_applied)]

    rows = db.execute(
        select(Application, Job.title, User.full_name)
        .join(Job, Job.id == Application.job_id)
        .join(User, User.id == Application.candidate_id)
        .join(CandidateProfile, CandidateProfile.user_id == Application.candidate_id)  # no profile = no consent
        .where(*conditions)
        .order_by(Application.updated_at.desc())
        .limit(scan_limit)
    ).all()

    seen: set[int] = set()
    out: list[tuple[Application, str, str]] = []
    for app, title, name in rows:  # newest application per candidate wins
        if app.candidate_id in seen:
            continue
        seen.add(app.candidate_id)
        out.append((app, title, name))
    return out


# ---------- pool ----------
def pool(db: Session, user: User, job_id: int, limit: int) -> list[PoolCandidateOut]:
    job = jobs_svc.get_owned_job(db, job_id, user)  # 404 for someone else's job
    days = retention_days()
    now = datetime.now(timezone.utc)

    out: list[PoolCandidateOut] = []
    for app, source_title, name in eligible_applications(db, user.id, target_job_id=job.id):
        computed = apps_svc.compute_scores(job, app.resume_data, app.resume_text)
        if not apps_svc.has_skill_evidence(computed):
            continue
        expires = app.updated_at + timedelta(days=days)
        out.append(PoolCandidateOut(
            candidate_id=app.candidate_id, name=name, match_score=computed["overall_score"],
            matched_skills=[r["skill"] for r in computed["skill_results"] if r["state"] == "confirmed"],
            gaps=computed["gaps"], source_application_id=app.id, source_job_title=source_title,
            previous_status=app.status, consent_given=True, retention_expires_at=expires,
            retention_days_left=max(0, (expires - now).days),
        ))
    out.sort(key=lambda p: (-p.match_score, p.candidate_id))
    return out[:limit]