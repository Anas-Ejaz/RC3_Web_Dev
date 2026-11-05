"""Import every model module here so Alembic autogenerate sees them.

Phase 1+ will add lines like: from app.models import user  # noqa: F401
"""
from app.models.base import Base  # noqa: F401