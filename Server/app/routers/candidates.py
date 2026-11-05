"""Candidate-only endpoints: profile and resume. Every route requires the candidate role."""
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_candidate
from app.core.errors import AppError
from app.models.candidate import Resume
from app.models.user import User
from app.schemas.candidate import ParsedResumeOut, ProfileIn, ProfileOut, ResumeCorrectionIn
from app.services import profiles, resumes

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