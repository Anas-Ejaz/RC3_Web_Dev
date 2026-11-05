"""Application endpoints. Candidate routes use require_candidate, everything else require_recruiter."""
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_candidate, require_recruiter
from app.models.enums import ApplicationStatus
from app.models.user import User
from app.schemas.application import (
    ApplicationDetailOut, ApplicationOut, AssessmentOut, AuditOut, CompareIn, CompareOut,
    NoteIn, NoteOut, OverrideIn, SkillsIn, StatusIn,
)
from app.schemas.common import Page, pagination
from app.services import applications as svc
from app.services import jobs as jobs_svc

router = APIRouter(tags=["applications"])


# ---------- candidate ----------
@router.post("/jobs/{job_id}/apply", response_model=ApplicationOut, status_code=201)
def apply(job_id: int, user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    app = svc.apply_to_job(db, job_id, user)
    return svc.serialize(db, [app], recruiter_view=False)[0]


@router.get("/candidate/applications", response_model=list[ApplicationOut])
def my_applications(user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    return svc.list_for_candidate(db, user)


# ---------- recruiter ----------
@router.get("/jobs/{job_id}/applications", response_model=Page[ApplicationOut])
def job_applications(
    job_id: int,
    sort: Literal["score", "date"] = "score",
    min_score: float | None = Query(None, ge=0, le=100),
    skill: str | None = Query(None, max_length=100),
    status: ApplicationStatus | None = None,
    paging: tuple[int, int] = Depends(pagination),
    user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    job = jobs_svc.get_owned_job(db, job_id, user)
    page, page_size = paging
    return svc.list_for_job(db, job, sort=sort, min_score=min_score, skill=skill, status=status, page=page, page_size=page_size)


@router.post("/applications/compare", response_model=list[CompareOut])
def compare(body: CompareIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.compare(db, user, body.application_ids)


@router.get("/applications/{application_id}", response_model=ApplicationDetailOut)
def application_detail(application_id: int, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.detail(db, svc.get_owned_application(db, application_id, user))


@router.post("/applications/{application_id}/status", response_model=ApplicationOut)
def set_status(application_id: int, body: StatusIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    app = svc.change_status(db, svc.get_owned_application(db, application_id, user), user, body.to_status, body.reason)
    return svc.serialize(db, [app], recruiter_view=True)[0]


@router.get("/applications/{application_id}/audit", response_model=list[AuditOut])
def audit(application_id: int, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    app = svc.get_owned_application(db, application_id, user)
    return svc._audit_rows(db, app.id)


@router.get("/applications/{application_id}/notes", response_model=list[NoteOut])
def get_notes(application_id: int, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    app = svc.get_owned_application(db, application_id, user)
    return svc.list_notes(db, app.id)


@router.post("/applications/{application_id}/notes", response_model=NoteOut, status_code=201)
def post_note(application_id: int, body: NoteIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.add_note(db, svc.get_owned_application(db, application_id, user), user, body.text)


@router.put("/applications/{application_id}/skills", response_model=AssessmentOut)
def put_skills(application_id: int, body: SkillsIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.correct_skills(db, svc.get_owned_application(db, application_id, user), body.skills)


@router.put("/applications/{application_id}/override", response_model=AssessmentOut)
def put_override(application_id: int, body: OverrideIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.override_score(db, svc.get_owned_application(db, application_id, user), user, body.score, body.reason)


@router.post("/applications/{application_id}/reassess", response_model=AssessmentOut)
def post_reassess(application_id: int, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.reassess(db, svc.get_owned_application(db, application_id, user))