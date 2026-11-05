"""Duplicate candidate detection and human-confirmed, non-destructive merge.

Signals, all computed in code:
  - normalized email (lowercase, +tags stripped, dots removed for gmail)  -> enough on its own
  - normalized phone (digits only, last 10)                                -> enough on its own
  - resume embedding similarity (mean of chunk embeddings, cosine >= DUPLICATE_SIMILARITY_THRESHOLD)
Scope: candidates who applied to THIS recruiter's jobs. Never logs resume text.
"""
from datetime import datetime, timezone
from itertools import combinations

import numpy as np
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.models.application import Application, AuditLog
from app.models.candidate import CandidateProfile, Resume
from app.models.job import Job
from app.models.talent import DuplicateCandidate, ResumeChunk
from app.models.user import User
from app.schemas.talent import DuplicateOut, DuplicatePartyOut, DuplicateStatusOut, MergeOut
from app.services import search as search_svc

MAX_APPLICATIONS = 600
MAX_EMBED_CANDIDATES = 150
_GMAIL = {"gmail.com", "googlemail.com"}


# ---------- normalization ----------
def normalize_email(value: str | None) -> str | None:
    if not value or "@" not in value:
        return None
    local, _, domain = value.strip().lower().rpartition("@")
    local = local.split("+", 1)[0]
    if domain in _GMAIL:
        local, domain = local.replace(".", ""), "gmail.com"
    return f"{local}@{domain}" if local and domain else None


def normalize_phone(value: str | None) -> str | None:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else None


# ---------- scan ----------
def _identifiers(db: Session, user: User) -> tuple[dict[int, int], dict[tuple[int, int], list[str]]]:
    """Return (candidate_id -> newest application id, pair -> identifier-based reasons)."""
    rows = db.execute(
        select(Application.id, Application.candidate_id, Application.resume_data)
        .join(Job, Job.id == Application.job_id)
        .join(User, User.id == Application.candidate_id)
        .where(Job.recruiter_id == user.id, User.role == "candidate")
        .order_by(Application.updated_at.desc())
        .limit(MAX_APPLICATIONS)
    ).all()

    newest: dict[int, int] = {}
    emails: dict[int, set[str]] = {}
    phones: dict[int, set[str]] = {}
    for app_id, cid, data in rows:
        newest.setdefault(cid, app_id)
        snap = data or {}
        if (e := normalize_email(snap.get("email"))):
            emails.setdefault(cid, set()).add(e)
        if (p := normalize_phone(snap.get("phone"))):
            phones.setdefault(cid, set()).add(p)

    ids = list(newest)
    if ids:
        for cid, email in db.execute(select(User.id, User.email).where(User.id.in_(ids))).all():
            if (e := normalize_email(email)):
                emails.setdefault(cid, set()).add(e)
        for cid, email, phone in db.execute(
            select(Resume.candidate_id, Resume.email, Resume.phone).where(Resume.candidate_id.in_(ids))
        ).all():
            if (e := normalize_email(email)):
                emails.setdefault(cid, set()).add(e)
            if (p := normalize_phone(phone)):
                phones.setdefault(cid, set()).add(p)
        for cid, phone in db.execute(
            select(CandidateProfile.user_id, CandidateProfile.phone).where(CandidateProfile.user_id.in_(ids))
        ).all():
            if (p := normalize_phone(phone)):
                phones.setdefault(cid, set()).add(p)

    reasons: dict[tuple[int, int], list[str]] = {}

    def _link(index: dict[int, set[str]], label: str) -> None:
        by_value: dict[str, set[int]] = {}
        for cid, values in index.items():
            for v in values:
                by_value.setdefault(v, set()).add(cid)
        for members in by_value.values():
            for a, b in combinations(sorted(members), 2):
                bucket = reasons.setdefault((a, b), [])
                if label not in bucket:
                    bucket.append(label)

    _link(emails, "Same normalized email")
    _link(phones, "Same phone number")
    return newest, reasons


def _embedding_pairs(db: Session, user: User, newest: dict[int, int]) -> dict[tuple[int, int], float]:
    """Cosine similarity (>= threshold) between mean chunk embeddings of each candidate's newest application."""
    cids = list(newest)[:MAX_EMBED_CANDIDATES]
    if len(cids) < 2:
        return {}
    apps = {a.id: a for a in db.scalars(select(Application).where(Application.id.in_([newest[c] for c in cids])))}
    for cid in cids:
        search_svc.ensure_indexed(db, apps[newest[cid]])
    db.commit()

    chunk_rows = db.execute(
        select(ResumeChunk.application_id, ResumeChunk.embedding)
        .where(ResumeChunk.application_id.in_([newest[c] for c in cids]))
    ).all()
    by_app: dict[int, list[np.ndarray]] = {}
    for app_id, emb in chunk_rows:
        by_app.setdefault(app_id, []).append(np.asarray(emb, dtype=float))

    ordered: list[int] = []
    vectors: list[np.ndarray] = []
    for cid in cids:
        vecs = by_app.get(newest[cid])
        if not vecs:
            continue
        mean = np.mean(vecs, axis=0)
        norm = float(np.linalg.norm(mean))
        if norm:
            ordered.append(cid)
            vectors.append(mean / norm)
    if len(ordered) < 2:
        return {}

    matrix = np.vstack(vectors)
    sims = matrix @ matrix.T
    threshold = float(settings.duplicate_similarity_threshold)
    out: dict[tuple[int, int], float] = {}
    for i, j in combinations(range(len(ordered)), 2):
        if sims[i, j] >= threshold:
            a, b = sorted((ordered[i], ordered[j]))
            out[(a, b)] = float(sims[i, j])
    return out


def scan(db: Session, user: User) -> None:
    """Detect pairs and upsert pending rows. Dismissed and merged pairs are never re-created or reopened."""
    newest, reasons = _identifiers(db, user)

    try:
        text_sims = _embedding_pairs(db, user, newest)
    except AppError:
        text_sims = {}  # embedding model unavailable: email/phone signals still work

    found: dict[tuple[int, int], tuple[float, list[str]]] = {}
    for pair in set(reasons) | set(text_sims):
        why = list(reasons.get(pair, []))
        sim = text_sims.get(pair)
        if sim is not None:
            why.append(f"Resume text {round(sim * 100)}% similar")
        found[pair] = (1.0 if reasons.get(pair) else round(sim or 0.0, 4), why)

    existing = {
        (r.candidate_a_id, r.candidate_b_id): r
        for r in db.scalars(select(DuplicateCandidate).where(DuplicateCandidate.recruiter_id == user.id))
    }
    for (a, b), (similarity, why) in found.items():
        row = existing.get((a, b))
        if row is None:
            db.add(DuplicateCandidate(recruiter_id=user.id, candidate_a_id=a, candidate_b_id=b,
                                      similarity=similarity, reasons=why, status="pending"))
        elif row.status == "pending":
            row.similarity, row.reasons = similarity, why
    db.commit()


def list_pending(db: Session, user: User) -> list[DuplicateOut]:
    scan(db, user)
    rows = db.scalars(
        select(DuplicateCandidate)
        .where(DuplicateCandidate.recruiter_id == user.id, DuplicateCandidate.status == "pending")
        .order_by(DuplicateCandidate.similarity.desc(), DuplicateCandidate.id)
    ).all()
    ids = {r.candidate_a_id for r in rows} | {r.candidate_b_id for r in rows}
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(ids))).all()) if ids else {}
    return [
        DuplicateOut(
            id=r.id,
            candidate_a=DuplicatePartyOut(candidate_id=r.candidate_a_id, name=names.get(r.candidate_a_id, "")),
            candidate_b=DuplicatePartyOut(candidate_id=r.candidate_b_id, name=names.get(r.candidate_b_id, "")),
            similarity=round(r.similarity, 4),
            reasons=list(r.reasons or []),
        )
        for r in rows
    ]


# ---------- resolve ----------
def _get_owned_pair(db: Session, user: User, pair_id: int) -> DuplicateCandidate:
    row = db.scalar(select(DuplicateCandidate).where(
        DuplicateCandidate.id == pair_id, DuplicateCandidate.recruiter_id == user.id))
    if row is None:
        raise AppError(404, "NOT_FOUND", "Duplicate pair not found")  # also for other recruiters' rows
    return row


def _require_pending(row: DuplicateCandidate) -> None:
    if row.status != "pending":
        raise AppError(409, "DUPLICATE_ALREADY_RESOLVED", f"This pair is already {row.status}.")


def dismiss(db: Session, user: User, pair_id: int) -> DuplicateStatusOut:
    row = _get_owned_pair(db, user, pair_id)
    _require_pending(row)
    row.status, row.resolved_by_id, row.resolved_at = "dismissed", user.id, datetime.now(timezone.utc)
    db.commit()
    return DuplicateStatusOut(id=row.id, status=row.status)


def merge(db: Session, user: User, pair_id: int, primary_id: int, reason: str) -> MergeOut:
    """Consolidate the secondary candidate's applications on THIS recruiter's jobs into the primary.

    Non-destructive: accounts and resumes stay. An application moves only if the primary has no application
    for the same job; conflicting ones stay where they are and are reported as skipped. One audit row per
    moved application. updated_at is preserved so a merge does not extend the retention window.
    """
    row = _get_owned_pair(db, user, pair_id)
    _require_pending(row)
    if primary_id not in (row.candidate_a_id, row.candidate_b_id):
        raise AppError(422, "VALIDATION_ERROR", "primary_candidate_id must be one of the two candidates in this pair",
                       {"primary_candidate_id": "Must be one of the candidates in this pair"})
    secondary_id = row.candidate_b_id if primary_id == row.candidate_a_id else row.candidate_a_id

    primary_jobs = set(db.scalars(
        select(Application.job_id).join(Job, Job.id == Application.job_id)
        .where(Application.candidate_id == primary_id, Job.recruiter_id == user.id)
    ))
    secondary_apps = db.scalars(
        select(Application).join(Job, Job.id == Application.job_id)
        .where(Application.candidate_id == secondary_id, Job.recruiter_id == user.id)
        .order_by(Application.id)
    ).all()

    moved: list[int] = []
    skipped: list[int] = []
    for app in secondary_apps:
        if app.job_id in primary_jobs:
            skipped.append(app.id)
            continue
        db.execute(update(Application).where(Application.id == app.id)
                   .values(candidate_id=primary_id, updated_at=app.updated_at))
        db.add(AuditLog(
            application_id=app.id, from_status=app.status, to_status=app.status,
            changed_by=user.full_name, changed_by_id=user.id,
            reason=f"Merged duplicate candidate {secondary_id} into candidate {primary_id}: {reason}",
        ))
        primary_jobs.add(app.job_id)
        moved.append(app.id)

    row.status, row.resolved_by_id, row.resolved_at = "merged", user.id, datetime.now(timezone.utc)
    db.commit()
    return MergeOut(moved_application_ids=moved, skipped_application_ids=skipped)