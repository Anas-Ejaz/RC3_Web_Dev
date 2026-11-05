"""SQLAlchemy engine, session factory and FastAPI session dependency."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# pool_pre_ping keeps connections healthy on serverless Postgres (Neon/Supabase) that close idle sockets.
engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=5, max_overflow=5)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a DB session per request and always close it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()