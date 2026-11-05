"""Interview scheduling (with conflict detection), feedback, final decision and notifications.

Access rules:
  - The recruiter who owns the job can schedule, edit, cancel, decide.
  - The assigned interviewer (any recruiter account) can see their interview and submit feedback.
  - Candidates never reach these routes; they only receive simulated notifications.
Conflicts never leak other recruiters' candidate names: those show as "another booking".
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.application import Application
from app.models.enums import ApplicationStatus, Role
from app.models.interview import Interview, InterviewFeedback
from app.models.job import Job
from app.models.user import User
from app.schemas.application import ApplicationOut
from app.schemas.interview import FeedbackIn, FeedbackOut, InterviewIn, InterviewOut, InterviewUpdate, Ratings
from app.services import applications as apps_svc
from app.services.notifications import notify

MAX_DURATION = 480
PAST_GRACE = timedelta(minutes=1)


class SchedulingConflict(Exception):
    """Raised when the interviewer or candidate is double-booked and force=false."""

    def __init__(self, conflicts: list[dict]) -> None:
        super().__init__("scheduling conflict")
        self.conflicts = conflicts


def _utc(v: datetime | None) -> datetime | None:
    if v is None:
        return None
    return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v.astimezone(timezone.utc)


def _when(dt: datetime) -> str:
    return f"{dt.astimezone(timezone.utc):%Y-%m-%d %H:%M} UTC"


# ---------- lookups ----------
def list_interviewers(db: Session) -> list[User]:
    return list(db.scalars(select(User).where(User.role == Role.recruiter.value).order_by(User.full_name)).all())


def _check_interviewer(db: Session, interviewer_id: int) -> User:
    u = db.get(User, interviewer_id)
    if u is None or u.role != Role.recruiter.value:
        raise AppError(422, "INVALID_INTERVIEWER", "Interviewer must be an existing recruiter account",
                       {"interviewer_id": "Unknown interviewer"})
    return u


def _check_future(when: datetime) -> None:
    if when < datetime.now(timezone.utc) - PAST_GRACE:
        raise AppError(422, "SCHEDULE_IN_PAST", "Interviews must be scheduled in the future",
                       {"scheduled_at": "Must be in the future"})


def get_owned_interview(db: Session, interview_id: int, user: User) -> Interview:
    iv = db.scalar(
        select(Interview).join(Application, Application.id == Interview.application_id)
        .join(Job, Job.id == Application.job_id)
        .where(Interview.id == interview_id, Job.recruiter_id == user.id)
    )
    if iv is None:
        raise AppError(404, "INTERVIEW_NOT_FOUND", "Interview not found")
    return iv


def get_interview_for_viewer(db: Session, interview_id: int, user: User) -> Interview:
    """Job owner OR the assigned interviewer."""
    iv = db.scalar(
        select(Interview).join(Application, Application.id == Interview.application_id)
        .join(Job, Job.id == Application.job_id)
        .where(Interview.id == interview_id, or_(Job.recruiter_id == user.id, Interview.interviewer_id == user.id))
    )
    if iv is None:
        raise AppError(404, "INTERVIEW_NOT_FOUND", "Interview not found")
    return iv


# ---------- conflict detection ----------
def find_conflicts(
    db: Session, *, viewer_id: int, interviewer_id: int, candidate_id: int,
    start: datetime, duration: int, exclude_id: int | None = None,
) -> list[dict]:
    """Overlapping scheduled interviews for the same interviewer OR the same candidate.

    Two slots overlap when a.start < b.end and b.start < a.end, so back-to-back slots are allowed.
    """
    end = start + timedelta(minutes=duration)
    rows = db.execute(
        select(Interview, Application.candidate_id, Job.recruiter_id)
        .join(Application, Application.id == Interview.application_id)
        .join(Job, Job.id == Application.job_id)
        .where(
            Interview.status == "scheduled",
            Interview.scheduled_at < end,
            Interview.scheduled_at > start - timedelta(minutes=MAX_DURATION),
            or_(Interview.interviewer_id == interviewer_id, Application.candidate_id == candidate_id),
        )
    ).all()

    hits = []
    for iv, cand_id, owner_id in rows:
        if exclude_id is not None and iv.id == exclude_id:
            continue
        iv_start = _utc(iv.scheduled_at)
        iv_end = iv_start + timedelta(minutes=iv.duration_minutes)
        if iv_start < end and start < iv_end:
            hits.append((iv, cand_id, owner_id, iv_start))
    if not hits:
        return []

    ids = {h[1] for h in hits} | {h[0].interviewer_id for h in hits}
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(ids))).all())
    out = []
    for iv, cand_id, owner_id, iv_start in sorted(hits, key=lambda h: h[3]):
        kind = "interviewer" if iv.interviewer_id == interviewer_id else "candidate"
        if owner_id == viewer_id:
            label = names.get(cand_id, "") if kind == "interviewer" else names.get(iv.interviewer_id, "")
        else:
            label = "another booking"
        out.append({"interview_id": iv.id, "scheduled_at": iv_start, "with": label, "kind": kind})
    return out


# ---------- serialization ----------
def serialize(db: Session, items: list[Interview]) -> list[InterviewOut]:
    if not items:
        return []
    apps = {a.id: a for a in db.scalars(select(Application).where(Application.id.in_({i.application_id for i in items}))).all()}
    titles = dict(db.execute(select(Job.id, Job.title).where(Job.id.in_({a.job_id for a in apps.values()}))).all())
    fbs = list(db.scalars(
        select(InterviewFeedback).where(InterviewFeedback.interview_id.in_([i.id for i in items])).order_by(InterviewFeedback.id)
    ).all())
    user_ids = {a.candidate_id for a in apps.values()} | {i.interviewer_id for i in items} | {f.author_id for f in fbs}
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(user_ids))).all())

    by_iv: dict[int, list[FeedbackOut]] = {}
    for f in fbs:
        by_iv.setdefault(f.interview_id, []).append(FeedbackOut(
            id=f.id, author=names.get(f.author_id, ""), ratings=Ratings.model_validate(f.ratings),
            strengths=f.strengths, concerns=f.concerns, recommendation=f.recommendation, created_at=f.created_at,
        ))
    return [
        InterviewOut(
            id=i.id, application_id=i.application_id,
            candidate_name=names.get(apps[i.application_id].candidate_id, ""),
            job_title=titles.get(apps[i.application_id].job_id, ""),
            scheduled_at=i.scheduled_at, duration_minutes=i.duration_minutes,
            interviewer_id=i.interviewer_id, interviewer_name=names.get(i.interviewer_id, ""),
            type=i.type, location_or_link=i.location_or_link, status=i.status, feedback=by_iv.get(i.id, []),
        )
        for i in items
    ]


def list_interviews(
    db: Session, user: User, *, from_: datetime | None, to: datetime | None, interviewer_id: int | None
) -> list[InterviewOut]:
    stmt = (
        select(Interview).join(Application, Application.id == Interview.application_id)
        .join(Job, Job.id == Application.job_id)
        .where(or_(Job.recruiter_id == user.id, Interview.interviewer_id == user.id))
    )
    if from_:
        stmt = stmt.where(Interview.scheduled_at >= _utc(from_))
    if to:
        stmt = stmt.where(Interview.scheduled_at <= _utc(to))
    if interviewer_id:
        stmt = stmt.where(Interview.interviewer_id == interviewer_id)
    return serialize(db, list(db.scalars(stmt.order_by(Interview.scheduled_at).limit(200)).all()))


# ---------- schedule / update ----------
def schedule(db: Session, user: User, body: InterviewIn) -> InterviewOut:
    app = apps_svc.get_owned_application(db, body.application_id, user)
    if app.status not in ("shortlisted", "interview"):
        raise AppError(409, "INVALID_APPLICATION_STATE",
                       f"Interviews can only be scheduled for shortlisted candidates (current status: '{app.status}')")
    interviewer = _check_interviewer(db, body.interviewer_id)
    _check_future(body.scheduled_at)

    conflicts = find_conflicts(db, viewer_id=user.id, interviewer_id=interviewer.id, candidate_id=app.candidate_id,
                               start=body.scheduled_at, duration=body.duration_minutes)
    if conflicts and not body.force:
        raise SchedulingConflict(conflicts)

    job = db.get(Job, app.job_id)
    iv = Interview(application_id=app.id, interviewer_id=interviewer.id, created_by_id=user.id,
                   scheduled_at=body.scheduled_at, duration_minutes=body.duration_minutes,
                   type=body.type, location_or_link=body.location_or_link.strip(), status="scheduled")
    db.add(iv)
    db.flush()

    # The recruiter explicitly scheduled this, so the move shortlisted -> interview is a manual action,
    # audited under the recruiter's name (not "system").
    if app.status == "shortlisted":
        apps_svc._log(db, app.id, "shortlisted", "interview", user.full_name, user.id, "Interview scheduled")
        app.status = "interview"

    candidate_name = db.scalar(select(User.full_name).where(User.id == app.candidate_id)) or "the candidate"
    where = iv.location_or_link
    notify(db, app.candidate_id, "interview_scheduled", "Interview scheduled",
           f"A {iv.type} interview for {job.title} is scheduled for {_when(body.scheduled_at)} "
           f"({iv.duration_minutes} min). Location/link: {where}")
    if interviewer.id != user.id:
        notify(db, interviewer.id, "interview_assigned", "Interview assigned",
               f"You are assigned to interview {candidate_name} for {job.title} on {_when(body.scheduled_at)} ({iv.duration_minutes} min).")
    db.commit()
    db.refresh(iv)
    return serialize(db, [iv])[0]


def update_interview(db: Session, user: User, interview_id: int, body: InterviewUpdate) -> InterviewOut:
    iv = get_owned_interview(db, interview_id, user)
    if iv.status != "scheduled":
        raise AppError(409, "INTERVIEW_NOT_EDITABLE", f"A {iv.status} interview cannot be changed")
    app = db.get(Application, iv.application_id)
    job = db.get(Job, app.job_id)
    data = {k: v for k, v in body.model_dump(exclude={"force"}).items() if v is not None}

    if data.get("status") == "cancelled":
        iv.status = "cancelled"
        notify(db, app.candidate_id, "interview_cancelled", "Interview cancelled",
               f"Your interview for {job.title} on {_when(_utc(iv.scheduled_at))} was cancelled.")
        if iv.interviewer_id != user.id:
            notify(db, iv.interviewer_id, "interview_cancelled", "Interview cancelled",
                   f"The interview for {job.title} on {_when(_utc(iv.scheduled_at))} was cancelled.")
        db.commit()
        db.refresh(iv)
        return serialize(db, [iv])[0]

    if "interviewer_id" in data:
        _check_interviewer(db, data["interviewer_id"])
    if "scheduled_at" in data:
        _check_future(data["scheduled_at"])

    timing_changed = any(k in data for k in ("scheduled_at", "duration_minutes", "interviewer_id"))
    if timing_changed:
        conflicts = find_conflicts(
            db, viewer_id=user.id,
            interviewer_id=data.get("interviewer_id", iv.interviewer_id), candidate_id=app.candidate_id,
            start=data.get("scheduled_at", _utc(iv.scheduled_at)),
            duration=data.get("duration_minutes", iv.duration_minutes), exclude_id=iv.id,
        )
        if conflicts and not body.force:
            raise SchedulingConflict(conflicts)

    for key in ("scheduled_at", "duration_minutes", "interviewer_id", "type", "location_or_link"):
        if key in data:
            setattr(iv, key, data[key].strip() if isinstance(data[key], str) else data[key])
    if timing_changed or "location_or_link" in data:
        notify(db, app.candidate_id, "interview_updated", "Interview updated",
               f"Your {iv.type} interview for {job.title} is now {_when(_utc(iv.scheduled_at))} "
               f"({iv.duration_minutes} min). Location/link: {iv.location_or_link}")
    db.commit()
    db.refresh(iv)
    return serialize(db, [iv])[0]


# ---------- feedback / decision ----------
def submit_feedback(db: Session, user: User, interview_id: int, body: FeedbackIn) -> InterviewOut:
    iv = get_interview_for_viewer(db, interview_id, user)
    if iv.status == "cancelled":
        raise AppError(409, "INTERVIEW_CANCELLED", "Feedback cannot be added to a cancelled interview")
    fb = db.scalar(select(InterviewFeedback).where(
        InterviewFeedback.interview_id == iv.id, InterviewFeedback.author_id == user.id))
    if fb is None:
        fb = InterviewFeedback(interview_id=iv.id, author_id=user.id)
    fb.ratings = body.ratings.model_dump()
    fb.strengths = body.strengths.strip()
    fb.concerns = body.concerns.strip()
    fb.recommendation = body.recommendation
    db.add(fb)
    iv.status = "completed"
    db.commit()
    db.refresh(iv)
    return serialize(db, [iv])[0]


def decide(db: Session, user: User, application_id: int, decision: str, reason: str) -> ApplicationOut:
    """Final decision (manual). Reuses change_status so the transition rules and the audit record are identical.

    The candidate notification states the outcome only; the recruiter's internal reason stays private.
    """
    app = apps_svc.get_owned_application(db, application_id, user)
    job = db.get(Job, app.job_id)
    label = "selected" if decision == "selected" else "not selected"
    # Added before change_status so both commit together; if the transition is invalid it raises and nothing is saved.
    notify(db, app.candidate_id, "decision", "Application update",
           f"Your application for {job.title} has been reviewed. Outcome: {label}.")
    updated = apps_svc.change_status(db, app, user, ApplicationStatus(decision), reason)
    return apps_svc.serialize(db, [updated], recruiter_view=True)[0]