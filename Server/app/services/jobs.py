"""Job CRUD, visibility/ownership rules and AI requirement extraction."""
from pydantic import BaseModel, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.application import Application
from app.core.config import settings
from app.core.errors import AppError
from app.models.enums import JobStatus, JobType, Role
from app.models.job import Job
from app.models.user import User
from app.schemas.common import Page
from app.schemas.job import ExtractOut, JobIn, JobOut, SkillReq
from app.services import llm
from app.services.normalize import normalize_skill


def _not_found() -> AppError:
    return AppError(404, "JOB_NOT_FOUND", "Job not found")


def _like(value: str) -> str:
    return "%" + value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def clean_skills(skills: list[SkillReq]) -> list[dict]:
    """Normalize names, de-duplicate (keep the highest importance)."""
    best: dict[str, dict] = {}
    for s in skills:
        name = normalize_skill(s.name)
        key = name.lower()
        if key not in best or s.importance > best[key]["importance"]:
            best[key] = {"name": name, "importance": s.importance}
    return list(best.values())


def applicant_counts(db: Session, job_ids: list[int]) -> dict[int, int]:
    """Number of applications per job (one grouped query)."""
    if not job_ids:
        return {}
    rows = db.execute(
        select(Application.job_id, func.count(Application.id))
        .where(Application.job_id.in_(job_ids))
        .group_by(Application.job_id)
    ).all()
    return {job_id: n for job_id, n in rows}


def to_out(job: Job, applicant_count: int = 0) -> JobOut:
    return JobOut.model_validate(job).model_copy(update={"applicant_count": applicant_count})


def get_owned_job(db: Session, job_id: int, user: User) -> Job:
    """Recruiter-only access: another recruiter's job looks like it does not exist."""
    job = db.get(Job, job_id)
    if job is None or job.recruiter_id != user.id:
        raise _not_found()
    return job


def get_visible_job(db: Session, job_id: int, user: User) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise _not_found()
    if user.role == Role.recruiter.value:
        if job.recruiter_id != user.id:
            raise _not_found()
    elif job.status != JobStatus.open.value:
        raise _not_found()
    return job


def list_jobs(
    db: Session, user: User, *, status: JobStatus | None, q: str | None,
    location: str | None, job_type: JobType | None, page: int, page_size: int,
) -> Page[JobOut]:
    is_recruiter = user.role == Role.recruiter.value
    stmt = select(Job)
    if is_recruiter:
        stmt = stmt.where(Job.recruiter_id == user.id)
        if status:
            stmt = stmt.where(Job.status == status.value)
    else:
        stmt = stmt.where(Job.status == JobStatus.open.value)  # candidates only ever see open jobs
    if q:
        pat = _like(q)
        stmt = stmt.where(or_(
            Job.title.ilike(pat, escape="\\"),
            Job.department.ilike(pat, escape="\\"),
            Job.description.ilike(pat, escape="\\"),
        ))
    if location:
        stmt = stmt.where(Job.location.ilike(_like(location), escape="\\"))
    if job_type:
        stmt = stmt.where(Job.type == job_type.value)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Job.created_at.desc(), Job.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    counts = applicant_counts(db, [j.id for j in rows]) if is_recruiter else {}
    items = [to_out(j, counts.get(j.id, 0)) for j in rows]
    return Page[JobOut](items=items, total=total, page=page, page_size=page_size)


def _fields(data: JobIn) -> dict:
    d = data.model_dump(exclude={"required_skills", "preferred_skills", "type"})
    d["type"] = data.type.value
    d["required_skills"] = clean_skills(data.required_skills)
    d["preferred_skills"] = clean_skills(data.preferred_skills)
    return d


def create_job(db: Session, user: User, data: JobIn) -> Job:
    job = Job(recruiter_id=user.id, status=JobStatus.open.value, **_fields(data))
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def update_job(db: Session, job: Job, data: JobIn) -> Job:
    for key, value in _fields(data).items():
        setattr(job, key, value)
    db.commit()
    db.refresh(job)
    return job


def set_status(db: Session, job: Job, status: JobStatus) -> Job:
    job.status = status.value
    db.commit()
    db.refresh(job)
    return job


# ---------- AI requirement extraction ----------
class _LLMSkill(BaseModel):
    name: str = ""
    importance: int = 3

    @field_validator("importance")
    @classmethod
    def _clamp(cls, v: int) -> int:
        return max(1, min(5, v))


class _LLMRequirements(BaseModel):
    required_skills: list[_LLMSkill] | None = None
    preferred_skills: list[_LLMSkill] | None = None
    min_experience_years: float | None = None
    qualifications: list[str] | None = None


_SYSTEM = """You extract hiring requirements from a job description. Output a JSON object with exactly these keys:
{"required_skills": [{"name": string, "importance": integer 1-5}],
 "preferred_skills": [{"name": string, "importance": integer 1-5}],
 "min_experience_years": number,
 "qualifications": [string]}
Rules:
- required_skills are must-haves; preferred_skills are nice-to-haves. Include only skills the text explicitly asks for.
- importance: 5 = critical/core, 3 = normal, 1 = minor.
- Use standard names for technologies (for example "PostgreSQL", "Kubernetes").
- min_experience_years is 0 when no minimum is stated.
- qualifications are degrees, certifications or licences only (not skills)."""


def _to_reqs(items: list[_LLMSkill] | None) -> list[SkillReq]:
    return [SkillReq(name=s.name.strip()[:100], importance=s.importance) for s in (items or []) if s.name.strip()]


def extract_requirements(description: str) -> ExtractOut:
    out = llm.generate_json(
        model=settings.groq_model_extract,
        system=_SYSTEM,
        user=f"JOB DESCRIPTION:\n{description[:12000]}",
        schema=_LLMRequirements,
    )
    return ExtractOut(
        required_skills=[SkillReq(**s) for s in clean_skills(_to_reqs(out.required_skills))],
        preferred_skills=[SkillReq(**s) for s in clean_skills(_to_reqs(out.preferred_skills))],
        min_experience_years=max(0.0, min(60.0, out.min_experience_years or 0.0)),
        qualifications=[q.strip()[:300] for q in (out.qualifications or []) if q and q.strip()][:30],
    )