"""Simulated notifications: stored rows only (nothing is emailed). Callers commit."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.interview import Notification


def notify(db: Session, user_id: int, kind: str, title: str, message: str) -> None:
    db.add(Notification(user_id=user_id, kind=kind, title=title[:200], message=message))


def list_for_user(db: Session, user_id: int, limit: int = 50) -> list[Notification]:
    """Always scoped to the logged-in user."""
    return list(
        db.scalars(
            select(Notification).where(Notification.user_id == user_id).order_by(Notification.id.desc()).limit(limit)
        ).all()
    )


def mark_read(db: Session, user_id: int, notification_id: int) -> Notification:
    n = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id))
    if n is None:
        raise AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found")
    n.read = True
    db.commit()
    db.refresh(n)
    return n