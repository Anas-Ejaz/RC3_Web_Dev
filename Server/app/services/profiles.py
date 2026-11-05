"""Candidate profile get/upsert."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candidate import CandidateProfile
from app.schemas.candidate import ProfileIn


def get_profile(db: Session, user_id: int) -> CandidateProfile | None:
    return db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == user_id))


def upsert_profile(db: Session, user_id: int, data: ProfileIn) -> CandidateProfile:
    profile = get_profile(db, user_id) or CandidateProfile(user_id=user_id)
    profile.headline = data.headline.strip()
    profile.phone = data.phone.strip()
    profile.location = data.location.strip()
    profile.interests = [i.strip()[:60] for i in data.interests if i.strip()]
    profile.summary = data.summary.strip()
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile