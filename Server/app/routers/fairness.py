"""Fairness endpoint (recruiter only; ownership checked in the service)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_recruiter
from app.models.user import User
from app.schemas.fairness import FairnessIn, FairnessOut
from app.services import fairness as svc

router = APIRouter(prefix="/fairness", tags=["fairness"])


@router.post("/test", response_model=FairnessOut)
def fairness_test(body: FairnessIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.run_test(db, user, body.application_id, list(body.attributes))