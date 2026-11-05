"""Retention purge. Dry-run by default; add --apply to execute.

WHAT IT DOES
  Selects applications whose last update (updated_at) is older than TALENT_POOL_RETENTION_DAYS AND whose
  candidate has NOT consented to the talent pool (no profile, or consent = false). For each one it:
    1. blanks the resume snapshot text (resume_text = "")
    2. replaces resume_data with an empty ParsedResume skeleton
    3. reduces the assessment to numbers only (scores, breakdown, override info); excerpts, explanation,
       gaps and learning suggestions are removed
    4. deletes the cached embedding chunks (resume_chunks) of that application
  updated_at is preserved, so the purge does not restart any clock; Application.score and status are kept.

WHAT IT NEVER TOUCHES
  - audit_logs: the audit trail (who/from/to/reason/when) is never deleted or edited. Reasons are recruiter-written text.
  - the candidate's own current resume (resumes table) and profile, recruiter notes, interviews, user accounts.
  - applications of candidates who consented (they stay in the talent pool until they revoke or the pool window ends).

Usage:
    python -m scripts.purge_retention                 # dry-run, prints counts and application ids only
    python -m scripts.purge_retention --apply
    python -m scripts.purge_retention --days 90 --apply
Never prints resume text.
"""
import argparse
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine
from app.models.application import Application
from app.models.candidate import CandidateProfile
from app.models.talent import ResumeChunk

KEEP_ASSESSMENT_KEYS = ("overall_score", "overridden", "override_score", "override_reason", "breakdown", "generated_at")
EMPTY_SNAPSHOT = {
    "name": None, "email": None, "phone": None, "links": [], "skills": [], "education": [],
    "experience": [], "projects": [], "unsupported_claims": [],
}


def purge(db: Session, days: int | None = None, apply: bool = False) -> dict:
    """Return {"application_ids": [...], "chunks": n, "applied": bool}. Changes data only when apply=True."""
    days = settings.talent_pool_retention_days if days is None else days
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    ids = list(db.scalars(
        select(Application.id)
        .outerjoin(CandidateProfile, CandidateProfile.user_id == Application.candidate_id)
        .where(
            Application.updated_at < cutoff,
            Application.resume_text != "",  # already purged rows are skipped (idempotent)
            or_(CandidateProfile.id.is_(None), CandidateProfile.talent_pool_consent.is_(False)),
        )
        .order_by(Application.id)
    ))
    chunks = db.scalar(select(func.count()).select_from(ResumeChunk).where(ResumeChunk.application_id.in_(ids))) if ids else 0
    if apply and ids:
        for application in db.scalars(select(Application).where(Application.id.in_(ids))):
            kept = {k: application.assessment[k] for k in KEEP_ASSESSMENT_KEYS if application.assessment and k in application.assessment}
            db.execute(update(Application).where(Application.id == application.id).values(
                resume_text="", resume_data=dict(EMPTY_SNAPSHOT), assessment=kept or None,
                updated_at=application.updated_at,  # explicit value: keeps the onupdate hook from touching it
            ))
        db.execute(delete(ResumeChunk).where(ResumeChunk.application_id.in_(ids)))
        db.commit()
    return {"application_ids": ids, "chunks": int(chunks or 0), "applied": bool(apply and ids)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Purge resume snapshots past retention for non-consenting candidates.")
    parser.add_argument("--days", type=int, default=None, help="override TALENT_POOL_RETENTION_DAYS")
    parser.add_argument("--apply", action="store_true", help="execute (default is a dry-run)")
    args = parser.parse_args()
    days = args.days if args.days is not None else settings.talent_pool_retention_days
    with Session(engine) as db:
        result = purge(db, days=days, apply=args.apply)
    mode = "APPLIED" if result["applied"] else ("DRY-RUN (nothing changed; use --apply)" if not args.apply else "nothing to do")
    print(f"Retention: {days} days | mode: {mode}")
    print(f"Applications affected: {len(result['application_ids'])} | embedding chunks removed: {result['chunks']}")
    if result["application_ids"]:
        print("Application ids:", ", ".join(map(str, result["application_ids"][:50])), "..." if len(result["application_ids"]) > 50 else "")
    print("Audit logs were not and are never touched by this script.")


if __name__ == "__main__":
    main()