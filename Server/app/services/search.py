"""Semantic talent search over the recruiter's own candidate pool.

Flow: LLM parses the query (a parse, never a score) -> shared pool rules -> anonymized resume chunks
(built lazily, cached per application, rebuilt when the stripped text changes) -> pgvector cosine search
-> score computed in code -> evidence excerpts verified against the stored resume text.

Never logs queries or resume text. Never states that a candidate lacks a skill.
"""
import hashlib
import re
from dataclasses import dataclass

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.models.application import Application
from app.models.talent import EMBEDDING_DIM, ResumeChunk
from app.models.user import User
from app.schemas.talent import SearchHitOut
from app.services import anonymize, embeddings, llm
from app.services import jobs as jobs_svc
from app.services import talent_pool as pool_svc
from app.services.normalize import normalize_skill, surface_forms
from app.services.verification import verify_excerpt

CHUNK_MAX_CHARS = 350
MAX_CHUNKS = 60
EXCERPT_MAX_CHARS = 300
TOP_CHUNKS = 3
SEARCH_SCAN_LIMIT = 200

# Score weights (all computed in code). With a minimum-experience requirement experience joins as a component.
W_SIM, W_COV = 0.6, 0.4
W_SIM_X, W_COV_X, W_EXP_X = 0.5, 0.35, 0.15

_STOPWORDS = {
    "a", "an", "and", "or", "the", "with", "in", "of", "for", "to", "who", "has", "have", "is", "are", "at",
    "least", "years", "year", "experience", "experienced", "candidate", "candidates", "find", "me", "looking",
    "someone", "good", "strong", "knows", "knowing", "on", "using", "that",
}

_SYSTEM = (
    "You turn a recruiter's search request into structured filters. You only PARSE the request; you never "
    "judge or score anyone. Return JSON with keys: "
    '"skills" (technical skills named or clearly implied, max 12), '
    '"min_experience_years" (number or null), '
    '"strict_min_experience" (true ONLY if the request explicitly says "at least"/"minimum" N years, else false), '
    '"keywords" (other useful words such as role titles or domains, max 8, no skills repeated).'
)


class QueryParse(BaseModel):
    """LLM parse of the natural-language query. Only a parse, never a score."""

    skills: list[str] = Field(default_factory=list)
    min_experience_years: float | None = None
    strict_min_experience: bool = False
    keywords: list[str] = Field(default_factory=list)

    @field_validator("skills", "keywords", mode="before")
    @classmethod
    def _clean_list(cls, v):
        if v is None:
            return []
        if not isinstance(v, list):
            raise ValueError("must be a list")
        cleaned = [str(x).strip() for x in v if str(x).strip()]
        return [x[:60] for x in cleaned][:15]

    @field_validator("min_experience_years", mode="before")
    @classmethod
    def _clean_years(cls, v):
        if v in (None, ""):
            return None
        try:
            years = float(v)
        except (TypeError, ValueError):
            return None
        return years if 0 < years <= 50 else None


@dataclass
class SearchResult:
    hits: list[SearchHitOut]
    mode: str  # "llm+embeddings" | "embeddings-only"
    fallback_reason: str | None = None  # LLM error code when mode is embeddings-only


# ---------- query parsing ----------
def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


def _fallback_parse(query: str) -> QueryParse:
    """No LLM: plain words of the query become keywords (still matched with word boundaries)."""
    words = re.findall(r"[A-Za-z0-9+#.]+", query)
    keywords = [w for w in words if len(w) >= 2 and w.lower() not in _STOPWORDS]
    return QueryParse(keywords=_dedupe(keywords)[:10])


def _parse_query(query: str) -> tuple[QueryParse, str | None]:
    """Return (parse, fallback_reason). Any LLM_* failure degrades to embedding-only search."""
    try:
        parsed = llm.generate_json(model=settings.groq_model_extract, system=_SYSTEM, user=query, schema=QueryParse)
    except AppError as exc:
        code = getattr(exc, "code", "") or ""
        if code and not code.startswith("LLM_"):
            raise
        return _fallback_parse(query), (code or "LLM_UNAVAILABLE")
    skills = _dedupe([normalize_skill(s) for s in parsed.skills if s.strip()])
    keywords = _dedupe([k for k in parsed.keywords if k.lower() not in {s.lower() for s in skills}])
    return QueryParse(
        skills=skills, keywords=keywords,
        min_experience_years=parsed.min_experience_years, strict_min_experience=parsed.strict_min_experience,
    ), None


# ---------- chunk index (lazy, cached per application) ----------
def index_hash(stripped_text: str) -> str:
    """Identifies what the chunks were built from: the anonymized text plus the embedding model."""
    return hashlib.sha256(f"{settings.embedding_model}|{EMBEDDING_DIM}|{stripped_text}".encode()).hexdigest()


def chunk_text(text: str) -> list[str]:
    """Split text into chunks made of whole lines (so each chunk is a real passage of the resume)."""
    chunks: list[str] = []
    current: list[str] = []
    size = 0
    for raw in text.splitlines():
        line = raw.strip()[:CHUNK_MAX_CHARS]
        if len(line) < 3:
            continue
        if current and size + len(line) + 1 > CHUNK_MAX_CHARS:
            chunks.append("\n".join(current))
            current, size = [], 0
        current.append(line)
        size += len(line) + 1
    if current:
        chunks.append("\n".join(current))
    return chunks[:MAX_CHUNKS]


def embed_checked(texts: list[str]) -> list[list[float]]:
    """embed() plus a guard that the vector length matches the pgvector column."""
    vectors = embeddings.embed(texts)
    if any(len(v) != EMBEDDING_DIM for v in vectors):
        raise AppError(503, "EMBEDDING_DIM_MISMATCH", f"Embedding model must return {EMBEDDING_DIM}-dim vectors.")
    return vectors


def ensure_indexed(db: Session, app: Application) -> str:
    """Make sure chunks exist and match the application's current text. Returns the anonymized text.

    Personal attributes are stripped BEFORE chunking and embedding. Flushes only; the caller commits once.
    """
    _, clean_text = anonymize.strip_for_scoring(app.resume_data or {}, app.resume_text or "")
    wanted = index_hash(clean_text)
    current = db.scalar(select(ResumeChunk.text_hash).where(ResumeChunk.application_id == app.id).limit(1))
    if current == wanted:
        return clean_text
    db.execute(delete(ResumeChunk).where(ResumeChunk.application_id == app.id))
    chunks = chunk_text(clean_text)
    if chunks:
        vectors = embed_checked(chunks)
        db.add_all(
            ResumeChunk(application_id=app.id, chunk_index=i, chunk_text=c, text_hash=wanted, embedding=v)
            for i, (c, v) in enumerate(zip(chunks, vectors))
        )
    db.flush()
    return clean_text


# ---------- candidate pool ----------
def _candidate_pool(db: Session, user: User, job) -> dict[int, tuple[Application, str]]:
    """candidate_id -> (application, name). Same permission rules as the talent pool (shared helper).

    If a job is given, that job's own applicants are added too (the recruiter already has them),
    and they win over a pool application of the same candidate.
    """
    rows = pool_svc.eligible_applications(
        db, user.id, target_job_id=job.id if job else None, scan_limit=SEARCH_SCAN_LIMIT
    )
    entries = {app.candidate_id: (app, name) for app, _title, name in rows}
    if job is not None:
        own = db.execute(
            select(Application, User.full_name)
            .join(User, User.id == Application.candidate_id)
            .where(Application.job_id == job.id)
            .order_by(Application.updated_at.desc())
            .limit(SEARCH_SCAN_LIMIT)
        ).all()
        for app, name in own:
            entries[app.candidate_id] = (app, name)
    return entries


# ---------- scoring helpers ----------
def _present(forms: list[str], text_lower: str) -> bool:
    """Word-boundary match that also works for names such as c++, c# and node.js."""
    for form in forms:
        f = form.strip().lower()
        if f and re.search(rf"(?<![\w+#]){re.escape(f)}(?![\w+#])", text_lower):
            return True
    return False


def _forms(term: str) -> list[str]:
    try:
        forms = [str(f) for f in surface_forms(term)]
    except Exception:  # noqa: BLE001 - an alias-table problem must not break search
        forms = []
    return list({*forms, term})


def _total_years(resume_data: dict) -> float:
    total = 0.0
    for exp in (resume_data or {}).get("experience") or []:
        try:
            total += max(0.0, float(exp.get("years") or 0))
        except (TypeError, ValueError, AttributeError):
            continue
    return total  # overlapping roles can double count; this is a rough component only


def combine_score(best_sim: float, coverage: float | None, years: float, min_years: float | None) -> float:
    """0-100, one decimal. All inputs are computed from embeddings and resume text, not from the LLM."""
    sim = max(0.0, min(1.0, best_sim))
    if coverage is None:
        value = sim
    elif min_years:
        exp = min(1.0, years / min_years)
        value = W_SIM_X * sim + W_COV_X * coverage + W_EXP_X * exp
    else:
        value = W_SIM * sim + W_COV * coverage
    return round(max(0.0, min(1.0, value)) * 100, 1)


def _excerpt(chunk: str) -> str:
    text = chunk.strip()
    if len(text) <= EXCERPT_MAX_CHARS:
        return text
    cut = text[:EXCERPT_MAX_CHARS]
    space = cut.rfind(" ")
    return (cut[:space] if space > EXCERPT_MAX_CHARS // 2 else cut).strip()


def _top_chunks(db: Session, app_ids: list[int], qvec: list[float]) -> dict[int, list[tuple[str, float]]]:
    """Top chunks per application by cosine similarity (pgvector)."""
    dist = ResumeChunk.embedding.cosine_distance(qvec)
    rank = func.row_number().over(partition_by=ResumeChunk.application_id, order_by=dist).label("rn")
    sub = select(ResumeChunk.application_id.label("app_id"), ResumeChunk.chunk_text.label("txt"),
                 dist.label("dist"), rank).where(ResumeChunk.application_id.in_(app_ids)).subquery()
    rows = db.execute(select(sub.c.app_id, sub.c.txt, sub.c.dist).where(sub.c.rn <= TOP_CHUNKS)
                      .order_by(sub.c.app_id, sub.c.dist)).all()
    out: dict[int, list[tuple[str, float]]] = {}
    for app_id, txt, d in rows:
        out.setdefault(app_id, []).append((txt, 1.0 - float(d)))
    return out


# ---------- public entry point ----------
def run(db: Session, user: User, *, query: str, job_id: int | None, limit: int) -> SearchResult:
    job = jobs_svc.get_owned_job(db, job_id, user) if job_id is not None else None  # 404 if not theirs
    parsed, fallback_reason = _parse_query(query)
    mode = "embeddings-only" if fallback_reason else "llm+embeddings"

    entries = _candidate_pool(db, user, job)
    if not entries:
        return SearchResult([], mode, fallback_reason)

    qvec = embed_checked([query])[0]
    texts = {cid: ensure_indexed(db, app) for cid, (app, _name) in entries.items()}
    db.commit()  # persist lazily built chunks once

    top = _top_chunks(db, [app.id for app, _ in entries.values()], qvec)
    terms = parsed.skills or parsed.keywords

    hits: list[SearchHitOut] = []
    for cid, (app, name) in entries.items():
        years = _total_years(app.resume_data)
        if parsed.strict_min_experience and parsed.min_experience_years and years < parsed.min_experience_years:
            continue  # the query explicitly said "at least N years"

        # Evidence: real lines only. Chunks whose excerpt fails verification are dropped and do not count.
        excerpts: list[str] = []
        verified_sims: list[float] = []
        for chunk, sim in top.get(app.id, []):
            ex = _excerpt(chunk)
            if verify_excerpt(ex, app.resume_text or "") and ex not in excerpts:
                excerpts.append(ex)
                verified_sims.append(sim)
        best_sim = max(verified_sims, default=0.0)

        text_lower = texts[cid].lower()
        found_skills = [s for s in parsed.skills if _present(_forms(s), text_lower)]
        found_keywords = [k for k in parsed.keywords if _present([k], text_lower)]
        found = found_skills if parsed.skills else found_keywords
        coverage = (len(found) / len(terms)) if terms else None

        score = combine_score(best_sim, coverage, years, parsed.min_experience_years)
        hits.append(SearchHitOut(
            candidate_id=cid, name=name, score=score,
            evidence_excerpts=excerpts[:TOP_CHUNKS],
            matched_terms=_dedupe(found_skills + found_keywords),
        ))

    hits.sort(key=lambda h: (-h.score, h.candidate_id))
    return SearchResult(hits[:limit], mode, fallback_reason)