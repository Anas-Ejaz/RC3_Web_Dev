"""Import every model module here so Alembic autogenerate sees them."""
from app.models.application import Application, ApplicationNote, AuditLog  # noqa: F401
from app.models.base import Base  # noqa: F401
from app.models.candidate import CandidateProfile, Resume  # noqa: F401
from app.models.job import Job  # noqa: F401
from app.models.user import User  # noqa: F401