"""Candidate-only endpoints: profile, resume, recommendations, talent-pool consent. Every route requires the candidate role."""
from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_candidate
from app.core.errors import AppError
from app.models.candidate import Resume
from app.models.user import User
from app.schemas.candidate import ParsedResumeOut, ProfileIn, ProfileOut, ResumeCorrectionIn
from app.schemas.talent import ConsentIn, ConsentOut, RecommendationOut
from app.services import profiles, recommendations, resumes
from app.services import talent_pool as pool_svc

router = APIRouter(prefix="/candidate", tags=["candidate"])


def _own_resume(db: Session, user: User) -> Resume:
    resume = resumes.get_resume(db, user.id)  # always scoped to the logged-in candidate
    if resume is None:
        raise AppError(404, "RESUME_NOT_FOUND", "No resume uploaded yet")
    return resume


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    return profiles.get_profile(db, user.id) or ProfileOut()


@router.put("/profile", response_model=ProfileOut)
def put_profile(body: ProfileIn, user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    return profiles.upsert_profile(db, user.id, body)


@router.post("/resume", response_model=ParsedResumeOut)
def upload_resume(file: UploadFile = File(...), user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    data = file.file.read(settings.max_upload_bytes + 1)  # +1 so oversize files are detected
    return resumes.process_upload(db, user, file.filename, data)


@router.get("/resume", response_model=ParsedResumeOut)
def get_resume(user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    return _own_resume(db, user)


@router.put("/resume/parsed", response_model=ParsedResumeOut)
def correct_resume(body: ResumeCorrectionIn, user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    return resumes.apply_corrections(db, _own_resume(db, user), body, editor="candidate")


@router.post("/resume/reparse", response_model=ParsedResumeOut)
def reparse_resume(user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    """Extra endpoint (not in contract): retry AI parsing after a failure such as a Groq timeout."""
    return resumes.reparse(db, _own_resume(db, user))


@router.get("/recommendations", response_model=list[RecommendationOut])
def get_recommendations(limit: int = Query(10, ge=1, le=20), user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    """Open jobs that fit the candidate's parsed resume. Empty list if there is no parsed resume yet."""
    return recommendations.recommend(db, user, limit)


@router.get("/talent-pool-consent", response_model=ConsentOut)
def get_consent(user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    """Extra endpoint (not in contract): whether past applications may be suggested for other jobs."""
    return pool_svc.get_consent(db, user.id)


@router.put("/talent-pool-consent", response_model=ConsentOut)
def put_consent(body: ConsentIn, user: User = Depends(require_candidate), db: Session = Depends(get_db)):
    """Extra endpoint (not in contract): opt in or out. Opting out removes the candidate from every pool immediately."""
    return pool_svc.set_consent(db, user.id, body.consent)