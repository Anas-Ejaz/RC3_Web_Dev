"""Registration and credential checking. Routers stay thin and call these."""
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import DUMMY_HASH, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import RegisterIn

_EMAIL_TAKEN = AppError(409, "EMAIL_EXISTS", "An account with this email already exists", {"email": "Already registered"})


def register_user(db: Session, data: RegisterIn) -> User:
    if db.scalar(select(User.id).where(User.email == data.email)) is not None:
        raise _EMAIL_TAKEN
    user = User(
        email=data.email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=data.role.value,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:  # two requests racing on the same email
        db.rollback()
        raise _EMAIL_TAKEN from exc
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User | None:
    """Return the user if credentials are valid, else None (never reveals which part was wrong)."""
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        verify_password(password, DUMMY_HASH)  # equalize timing
        return None
    if not verify_password(password, user.password_hash) or not user.is_active:
        return None
    return user