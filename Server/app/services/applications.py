"""Applications: apply, pipeline status + audit trail, notes, skill corrections, overrides, comparison.

Ownership: a recruiter reaches an application only through a job they own (404 otherwise).
Status changes by recruiters are manual and always audited. Only the automatic pipeline steps
(submitted -> parsed -> ai_assessment_available) are written by "system".
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.application import Application, ApplicationNote, AuditLog
from app.models.candidate import Resume
from app.models.enums import ApplicationStatus
from app.models.job import Job
from app.models.user import User
from app.schemas.application import (
    ApplicationDetailOut, ApplicationOut, AssessmentOut, AuditOut, CompareOut, NoteOut,
)
from app.schemas.candidate import ParsedResumeOut, SkillIn
from app.schemas.common import Page
from app.services import matching, resumes
from app.services.normalize import normalize_skill

logger = logging.getLogger("app.applications")

_REVIEW = {"recruiter_review", "shortlisted", "rejected"}
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "submitted": _REVIEW,
    "parsed": _REVIEW,
    "ai_assessment_available": _REVIEW,
    "recruiter_review": {"shortlisted", "rejected"},
    "shortlisted": {"recruiter_review", "interview", "rejected"},
    "interview": {"selected", "not_selected", "rejected"},
    "rejected": {"recruiter_review"},  # recruiters may reconsider
    "selected": set(),
    "not_selected": set(),
}
REASON_REQUIRED = {"rejected", "not_selected"}


# ---------- helpers ----------
def _log(db: Session, application_id: int, from_s: str | None, to_s: str, who: str, who_id: int | None, reason: str | None) -> None:
    db.add(AuditLog(application_id=application_id, from_status=from_s, to_status=to_s,
                    changed_by=who, changed_by_id=who_id, reason=reason))


def _job_dict(job: Job) -> dict:
    return {
        "title": job.title, "required_skills": job.required_skills, "preferred_skills": job.preferred_skills,
        "min_experience_years": job.min_experience_years, "qualifications": job.qualifications,
    }


def snapshot_resume(r: Resume) -> dict:
    return {
        "id": r.id, "parse_status": r.parse_status, "error_message": None, "name": r.name, "email": r.email,
        "phone": r.phone, "links": r.links, "skills": r.skills, "education": r.education,
        "experience": r.experience, "projects": r.projects, "unsupported_claims": r.unsupported_claims,
    }


def assessment_out(app: Application) -> AssessmentOut | None:
    if not app.assessment:
        return None
    data = dict(app.assessment)
    data["overridden"] = bool(app.overridden)
    data["override_score"] = app.override_score if app.overridden else None
    data["override_reason"] = app.override_reason if app.overridden else None
    return AssessmentOut.model_validate(data)


def serialize(db: Session, apps: list[Application], *, recruiter_view: bool) -> list[ApplicationOut]:
    cids, jids = {a.candidate_id for a in apps}, {a.job_id for a in apps}
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(cids))).all()) if cids else {}
    titles = dict(db.execute(select(Job.id, Job.title).where(Job.id.in_(jids))).all()) if jids else {}
    return [
        ApplicationOut(
            id=a.id, job_id=a.job_id, job_title=titles.get(a.job_id, ""), candidate_id=a.candidate_id,
            candidate_name=names.get(a.candidate_id, ""), status=a.status,
            assessment=assessment_out(a) if recruiter_view else None,  # candidates never see assessment internals
            submitted_at=a.submitted_at, updated_at=a.updated_at,
        )
        for a in apps
    ]


def get_owned_application(db: Session, application_id: int, user: User) -> Application:
    app = db.scalar(
        select(Application).join(Job, Job.id == Application.job_id)
        .where(Application.id == application_id, Job.recruiter_id == user.id)
    )
    if app is None:
        raise AppError(404, "APPLICATION_NOT_FOUND", "Application not found")
    return app


def run_assessment(app: Application, job: Job) -> None:
    """Score in code, then ask the LLM to explain the computed result. A recruiter override is preserved."""
    computed = matching.compute(_job_dict(job), app.resume_data, app.resume_text)
    computed.update(matching.explain(job.title, computed))
    computed["generated_at"] = datetime.now(timezone.utc).isoformat()
    app.assessment = computed
    app.score = app.override_score if app.overridden and app.override_score is not None else computed["overall_score"]


# ---------- candidate side ----------
def apply_to_job(db: Session, job_id: int, user: User) -> Application:
    job = db.get(Job, job_id)
    if job is None or job.status != "open":
        raise AppError(404, "JOB_NOT_FOUND", "Job not found")
    resume = resumes.get_resume(db, user.id)
    if resume is None or resume.parse_status != "parsed":
        raise AppError(409, "RESUME_REQUIRED", "Upload and successfully parse a resume before applying")
    if db.scalar(select(Application.id).where(Application.job_id == job_id, Application.candidate_id == user.id)):
        raise AppError(409, "ALREADY_APPLIED", "You have already applied to this job")

    app = Application(job_id=job_id, candidate_id=user.id, status="submitted",
                      resume_data=snapshot_resume(resume), resume_text=resume.raw_text)
    db.add(app)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(409, "ALREADY_APPLIED", "You have already applied to this job") from exc

    _log(db, app.id, None, "submitted", "system", None, "Application submitted")
    app.status = "parsed"
    _log(db, app.id, "submitted", "parsed", "system", None, "Resume snapshot attached")
    try:
        run_assessment(app, job)
        app.status = "ai_assessment_available"
        _log(db, app.id, "parsed", "ai_assessment_available", "system", None, "AI assessment generated")
    except AppError as exc:  # e.g. embedding model unavailable: keep the application, recruiter can Reassess
        logger.warning("Assessment deferred for application %s: %s", app.id, exc.code)
    db.commit()
    db.refresh(app)
    return app


def list_for_candidate(db: Session, user: User) -> list[ApplicationOut]:
    apps = db.scalars(select(Application).where(Application.candidate_id == user.id).order_by(Application.submitted_at.desc())).all()
    return serialize(db, list(apps), recruiter_view=False)


# ---------- recruiter side ----------
def list_for_job(
    db: Session, job: Job, *, sort: str, min_score: float | None, skill: str | None,
    status: ApplicationStatus | None, page: int, page_size: int,
) -> Page[ApplicationOut]:
    """In-memory filtering is fine at hackathon scale (one job has tens of applicants, not millions)."""
    apps = list(db.scalars(select(Application).where(Application.job_id == job.id)).all())
    if status:
        apps = [a for a in apps if a.status == status.value]
    if min_score is not None:
        apps = [a for a in apps if (a.score or 0) >= min_score]
    if skill:
        want = normalize_skill(skill).lower()
        # filter keeps applicants with confirmed OR weak evidence for the skill
        apps = [a for a in apps if any(
            r["skill"].lower() == want and r["state"] != "no_evidence_found"
            for r in (a.assessment or {}).get("skill_results", [])
        )]
    if sort == "score":
        apps.sort(key=lambda a: (a.score if a.score is not None else -1.0, a.submitted_at), reverse=True)
    else:
        apps.sort(key=lambda a: a.submitted_at, reverse=True)
    total = len(apps)
    chunk = apps[(page - 1) * page_size: page * page_size]
    return Page[ApplicationOut](items=serialize(db, chunk, recruiter_view=True), total=total, page=page, page_size=page_size)


def _audit_rows(db: Session, application_id: int) -> list[AuditOut]:
    rows = db.scalars(select(AuditLog).where(AuditLog.application_id == application_id).order_by(AuditLog.id)).all()
    return [AuditOut(from_status=r.from_status, to_status=r.to_status, changed_by=r.changed_by,
                     reason=r.reason, created_at=r.created_at) for r in rows]


def list_notes(db: Session, application_id: int) -> list[NoteOut]:
    rows = db.execute(
        select(ApplicationNote, User.full_name).join(User, User.id == ApplicationNote.author_id)
        .where(ApplicationNote.application_id == application_id).order_by(ApplicationNote.id)
    ).all()
    return [NoteOut(id=n.id, text=n.text, author=name, created_at=n.created_at) for n, name in rows]


def add_note(db: Session, app: Application, user: User, text: str) -> NoteOut:
    note = ApplicationNote(application_id=app.id, author_id=user.id, text=text)
    db.add(note)
    db.commit()
    db.refresh(note)
    return NoteOut(id=note.id, text=note.text, author=user.full_name, created_at=note.created_at)


def detail(db: Session, app: Application) -> ApplicationDetailOut:
    return ApplicationDetailOut(
        application=serialize(db, [app], recruiter_view=True)[0],
        resume=ParsedResumeOut.model_validate(app.resume_data),
        assessment=assessment_out(app),
        notes=list_notes(db, app.id),
        audit=_audit_rows(db, app.id),
    )


def change_status(db: Session, app: Application, user: User, to_status: ApplicationStatus, reason: str | None) -> Application:
    """Manual status change. Validates the transition, then writes the audit record (who, from, to, why, when)."""
    to, current = to_status.value, app.status
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if to not in allowed:
        raise AppError(409, "INVALID_TRANSITION", f"Cannot move from '{current}' to '{to}'. Allowed: {sorted(allowed) or 'none'}")
    reason = (reason or "").strip() or None
    if to in REASON_REQUIRED and not reason:
        raise AppError(422, "REASON_REQUIRED", "A reason is required for this decision", {"reason": "Required"})
    app.status = to
    _log(db, app.id, current, to, user.full_name, user.id, reason)
    db.commit()
    db.refresh(app)
    return app


def reassess(db: Session, app: Application) -> AssessmentOut:
    job = db.get(Job, app.job_id)
    run_assessment(app, job)
    if app.status in ("submitted", "parsed"):
        _log(db, app.id, app.status, "ai_assessment_available", "system", None, "AI assessment generated")
        app.status = "ai_assessment_available"
    db.commit()
    db.refresh(app)
    return assessment_out(app)  # type: ignore[return-value]


def correct_skills(db: Session, app: Application, skills: list[SkillIn]) -> AssessmentOut:
    """Recruiter edits the extracted skills. The same verification rules apply, then the application is re-scored."""
    data = app.resume_data
    merged = {
        "skills": [s.model_dump() for s in skills], "education": data.get("education"),
        "experience": data.get("experience"), "projects": data.get("projects"),
    }
    structured, claims = resumes.build_structured(merged, app.resume_text or "", editor="recruiter", previous=data.get("skills"))
    app.resume_data = {**data, **structured, "unsupported_claims": claims}  # reassign: JSON columns are not mutation-tracked
    return reassess(db, app)


def override_score(db: Session, app: Application, user: User, score: float, reason: str) -> AssessmentOut:
    if not app.assessment:
        raise AppError(409, "NO_ASSESSMENT", "This application has no assessment to override yet. Run Reassess first.")
    app.overridden, app.override_score, app.override_reason = True, round(score, 1), reason.strip()
    app.score = app.override_score
    _log(db, app.id, app.status, app.status, user.full_name, user.id,
         f"Score override: {app.assessment['overall_score']} -> {app.override_score}. {app.override_reason}")
    db.commit()
    db.refresh(app)
    return assessment_out(app)  # type: ignore[return-value]


def compare(db: Session, user: User, ids: list[int]) -> list[CompareOut]:
    apps = [get_owned_application(db, i, user) for i in ids]  # every id must belong to this recruiter
    names = {o.id: o.candidate_name for o in serialize(db, apps, recruiter_view=True)}
    out: list[CompareOut] = []
    for a in apps:
        results = sorted((a.assessment or {}).get("skill_results", []), key=lambda r: -r["importance"])
        evidence = [f"{r['skill']}: {r['evidence_excerpt']}" for r in results if r["state"] == "confirmed" and r.get("evidence_excerpt")][:5]
        out.append(CompareOut(application_id=a.id, candidate_name=names[a.id], assessment=assessment_out(a),
                              key_evidence=evidence, missing_info=(a.assessment or {}).get("gaps", [])))
    return out