"""FastAPI dependencies: current user and role guards. Every protected route must use one."""
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AppError
from app.core.security import decode_access_token
from app.models.enums import Role
from app.models.user import User


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        raise AppError(401, "UNAUTHORIZED", "Not authenticated")
    payload = decode_access_token(token)
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise AppError(401, "INVALID_TOKEN", "Session is invalid or expired") from exc
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise AppError(401, "UNAUTHORIZED", "Not authenticated")
    return user


def require_role(*roles: Role):
    """Build a dependency that allows only the given roles (checked against the DB, not the token)."""
    allowed = {r.value for r in roles}

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise AppError(403, "FORBIDDEN", "You do not have access to this resource")
        return user

    return dependency


require_recruiter = require_role(Role.recruiter)
require_candidate = require_role(Role.candidate)