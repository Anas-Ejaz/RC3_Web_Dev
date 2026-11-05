"""Talent intelligence endpoints (recruiter only): pool, semantic search, duplicates."""
from fastapi import APIRouter, Depends, Path, Query, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_recruiter
from app.models.user import User
from app.schemas.talent import (
    DuplicateOut,
    DuplicateStatusOut,
    MergeIn,
    MergeOut,
    PoolCandidateOut,
    SearchHitOut,
    SearchIn,
)
from app.services import duplicates as dup_svc
from app.services import search as search_svc
from app.services import talent_pool as pool_svc

router = APIRouter(prefix="/talent", tags=["talent"])


@router.get("/pool", response_model=list[PoolCandidateOut])
def talent_pool(
    job_id: int = Query(..., ge=1),
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    return pool_svc.pool(db, user, job_id, limit)


@router.post("/search", response_model=list[SearchHitOut])
def talent_search(
    body: SearchIn,
    response: Response,
    user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Semantic search. Header X-Search-Mode is 'llm+embeddings' or 'embeddings-only' (LLM down);
    X-Search-Fallback-Reason carries the LLM error code in the second case."""
    result = search_svc.run(db, user, query=body.query, job_id=body.job_id, limit=body.limit)
    response.headers["X-Search-Mode"] = result.mode
    if result.fallback_reason:
        response.headers["X-Search-Fallback-Reason"] = result.fallback_reason
    return result.hits


@router.get("/duplicates", response_model=list[DuplicateOut])
def list_duplicates(user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return dup_svc.list_pending(db, user)


@router.post("/duplicates/{duplicate_id}/dismiss", response_model=DuplicateStatusOut)
def dismiss_duplicate(
    duplicate_id: int = Path(..., ge=1),
    user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    return dup_svc.dismiss(db, user, duplicate_id)


@router.post("/duplicates/{duplicate_id}/merge", response_model=MergeOut)
def merge_duplicate(
    body: MergeIn,
    duplicate_id: int = Path(..., ge=1),
    user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    return dup_svc.merge(db, user, duplicate_id, body.primary_candidate_id, body.reason)