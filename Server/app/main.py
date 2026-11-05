"""FastAPI application entrypoint."""
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.routers import applications, auth, candidates, health, jobs

configure_logging()

app = FastAPI(
    title="Recruitment & Talent Intelligence API",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

# CORS restricted to the frontend origin only; credentials needed for the HttpOnly cookie.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

register_exception_handlers(app)

# All routes live under /api/v1 per the shared contract. Later phases include their routers here.
api_router = APIRouter(prefix=settings.api_prefix)
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(candidates.router)
api_router.include_router(applications.router)

app.include_router(api_router)