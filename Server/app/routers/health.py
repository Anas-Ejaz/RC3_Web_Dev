"""Liveness and readiness endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def liveness() -> dict:
    """Cheap check that the process is up (used by Docker/Render health checks)."""
    return {"status": "ok"}


@router.get("/db")
def readiness(db: Session = Depends(get_db)) -> dict:
    """Verify the database is reachable and the pgvector extension is installed."""
    try:
        db.execute(text("SELECT 1"))
        has_vector = db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).first() is not None
    except Exception as exc:  # noqa: BLE001
        raise AppError(503, "DB_UNAVAILABLE", "Database is not reachable") from exc
    if not has_vector:
        raise AppError(503, "PGVECTOR_MISSING", "pgvector extension is not enabled; run `alembic upgrade head`")
    return {"status": "ok", "database": "up", "pgvector": True}