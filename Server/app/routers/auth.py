"""Auth endpoints: register, login, logout, me."""
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.errors import AppError
from app.core.rate_limit import account_limiter, ip_limiter
from app.core.security import clear_auth_cookie, create_access_token, set_auth_cookie
from app.models.user import User
from app.schemas.auth import LoginIn, RegisterIn, UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)) -> User:
    user = auth_service.register_user(db, body)
    set_auth_cookie(response, create_access_token(user.id, user.role))  # log in immediately
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)) -> User:
    ip = request.client.host if request.client else "unknown"
    account_key = f"{ip}:{body.email}"
    ip_limiter.check(ip)
    account_limiter.check(account_key)

    user = auth_service.authenticate(db, body.email, body.password)
    if user is None:
        ip_limiter.record_failure(ip)
        account_limiter.record_failure(account_key)
        raise AppError(401, "INVALID_CREDENTIALS", "Invalid email or password")

    account_limiter.reset(account_key)
    set_auth_cookie(response, create_access_token(user.id, user.role))
    return user


@router.post("/logout")
def logout(response: Response) -> dict:
    clear_auth_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user