"""Job endpoints. Visibility and ownership are enforced in services/jobs.py."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_recruiter
from app.models.enums import JobStatus, JobType
from app.models.user import User
from app.schemas.common import Page, pagination
from app.schemas.job import ExtractIn, ExtractOut, JobIn, JobOut
from app.services import jobs as svc

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/extract-requirements", response_model=ExtractOut)
def extract_requirements(body: ExtractIn, _: User = Depends(require_recruiter)) -> ExtractOut:
    return svc.extract_requirements(body.description)


@router.get("", response_model=Page[JobOut])
def list_jobs(
    status: JobStatus | None = None,
    q: str | None = Query(None, max_length=100),
    location: str | None = Query(None, max_length=100),
    job_type: JobType | None = Query(None, alias="type"),
    paging: tuple[int, int] = Depends(pagination),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[JobOut]:
    page, page_size = paging
    return svc.list_jobs(db, user, status=status, q=q, location=location, job_type=job_type, page=page, page_size=page_size)


@router.post("", response_model=JobOut, status_code=201)
def create_job(body: JobIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)) -> JobOut:
    return svc.to_out(svc.create_job(db, user, body))


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> JobOut:
    job = svc.get_visible_job(db, job_id, user)
    counts = svc.applicant_counts(db, [job.id]) if user.role == "recruiter" else {}
    return svc.to_out(job, counts.get(job.id, 0))


@router.put("/{job_id}", response_model=JobOut)
def update_job(job_id: int, body: JobIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)) -> JobOut:
    return svc.to_out(svc.update_job(db, svc.get_owned_job(db, job_id, user), body))


@router.post("/{job_id}/close", response_model=JobOut)
def close_job(job_id: int, user: User = Depends(require_recruiter), db: Session = Depends(get_db)) -> JobOut:
    return svc.to_out(svc.set_status(db, svc.get_owned_job(db, job_id, user), JobStatus.closed))


@router.post("/{job_id}/reopen", response_model=JobOut)
def reopen_job(job_id: int, user: User = Depends(require_recruiter), db: Session = Depends(get_db)) -> JobOut:
    return svc.to_out(svc.set_status(db, svc.get_owned_job(db, job_id, user), JobStatus.open))