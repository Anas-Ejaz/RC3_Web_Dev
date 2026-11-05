"""Analytics endpoints (recruiter only). Optional job_id filters are ownership-checked."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_recruiter
from app.models.user import User
from app.schemas.analytics import ByJobOut, FunnelStageOut, OverviewOut, SkillGapOut
from app.services import analytics as svc
from app.services import jobs as jobs_svc

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _checked(db: Session, user: User, job_id: int | None) -> int | None:
    if job_id is not None:
        jobs_svc.get_owned_job(db, job_id, user)  # 404 for someone else's job
    return job_id


@router.get("/overview", response_model=OverviewOut)
def overview(user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.overview(db, user)


@router.get("/by-job", response_model=list[ByJobOut])
def by_job(user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.by_job(db, user)


@router.get("/funnel", response_model=list[FunnelStageOut])
def funnel(job_id: int | None = None, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    """Optional ?job_id= (extra, not in contract)."""
    return svc.funnel(db, user, _checked(db, user, job_id))


@router.get("/skill-gaps", response_model=list[SkillGapOut])
def skill_gaps(job_id: int | None = None, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    """Optional ?job_id= (extra, not in contract)."""
    return svc.skill_gaps(db, user, _checked(db, user, job_id))