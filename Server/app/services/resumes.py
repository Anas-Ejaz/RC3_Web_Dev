"""Resume pipeline: validated upload -> text -> LLM structuring -> evidence verification -> storage.

Resume text is never logged. Every item the LLM returns carries an evidence excerpt that is
fuzzy-checked against the real text. Failures are stored as verified=False / blank excerpt and
listed in unsupported_claims for manual review.
"""
import logging
import re
from datetime import date
from typing import Annotated

from pydantic import BaseModel, BeforeValidator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.models.candidate import Resume
from app.models.user import User
from app.schemas.candidate import ResumeCorrectionIn
from app.services import llm
from app.services.normalize import normalize_skill
from app.services.parsing import PdfError, extract_contacts, extract_text, validate_upload
from app.services.verification import verify_excerpt, verify_skill

logger = logging.getLogger("app.resumes")

MAX_SKILLS = 100
MAX_ITEMS = 20
NO_EXCERPT = "No evidence excerpt provided"
NOT_FOUND = "Evidence excerpt was not found in the resume text"


# ---------- lenient LLM output schema (coerces nulls / numbers so valid answers are not rejected) ----------
def _str(v):
    return "" if v is None else str(v).strip()


def _opt_str(v):
    return None if v is None or str(v).strip() == "" else str(v).strip()


def _list(v):
    return [] if v is None else v


def _opt_float(v):
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"\d+(?:\.\d+)?", str(v))
    return float(m.group()) if m else None


Str = Annotated[str, BeforeValidator(_str)]
OptStr = Annotated[str | None, BeforeValidator(_opt_str)]
OptFloat = Annotated[float | None, BeforeValidator(_opt_float)]


class _Skill(BaseModel):
    name: Str = ""
    evidence_excerpt: Str = ""


class _Edu(BaseModel):
    degree: Str = ""
    institution: Str = ""
    year: OptStr = None
    evidence_excerpt: Str = ""


class _Exp(BaseModel):
    title: Str = ""
    company: Str = ""
    start: OptStr = None
    end: OptStr = None
    years: OptFloat = None
    summary: Str = ""
    evidence_excerpt: Str = ""


class _Proj(BaseModel):
    name: Str = ""
    description: Str = ""
    technologies: Annotated[list[str], BeforeValidator(_list)] = []
    evidence_excerpt: Str = ""


class _LLMResume(BaseModel):
    name: Str = ""
    skills: Annotated[list[_Skill], BeforeValidator(_list)] = []
    education: Annotated[list[_Edu], BeforeValidator(_list)] = []
    experience: Annotated[list[_Exp], BeforeValidator(_list)] = []
    projects: Annotated[list[_Proj], BeforeValidator(_list)] = []


_SYSTEM = """You extract structured data from resume text. Output a JSON object with exactly these keys:
{"name": string,
 "skills": [{"name": string, "evidence_excerpt": string}],
 "education": [{"degree": string, "institution": string, "year": string|null, "evidence_excerpt": string}],
 "experience": [{"title": string, "company": string, "start": string|null, "end": string|null, "years": number|null, "summary": string, "evidence_excerpt": string}],
 "projects": [{"name": string, "description": string, "technologies": [string], "evidence_excerpt": string}]}
Rules:
- Include only information explicitly present in the resume text. Never infer or invent anything.
- evidence_excerpt must be copied VERBATIM from the resume text (one line or sentence, at most 200 characters) and must directly support the item.
- For a skill, the excerpt must be a resume line in which that skill appears.
- Use null, empty strings or empty lists when information is absent. Use "Present" as end for current roles.
- Do not score, rank or judge the candidate."""


# ---------- evidence verification of a structured payload ----------
_MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def _to_months(value: str | None) -> int | None:
    if not value:
        return None
    v = value.lower()
    if re.search(r"present|current|now|today", v):
        today = date.today()
        return today.year * 12 + today.month
    year = re.search(r"(?:19|20)\d{2}", v)
    if not year:
        return None
    month = next((n for k, n in _MONTHS.items() if k in v), 1)
    return int(year.group()) * 12 + month


def _years_between(start: str | None, end: str | None) -> float | None:
    """Experience duration computed in code from the dates (not trusted from the LLM)."""
    s, e = _to_months(start), _to_months(end)
    if s is None or e is None or e < s:
        return None
    return round((e - s) / 12, 1)


def _check_excerpt(excerpt: str | None, text: str) -> tuple[str, str | None]:
    ex = (excerpt or "").strip()[:500]
    if not ex:
        return "", NO_EXCERPT
    if verify_excerpt(ex, text):
        return ex, None
    return "", NOT_FOUND


def build_structured(
    data: dict, text: str, *, editor: str, previous: list[dict] | None = None
) -> tuple[dict, list[dict]]:
    """Normalize skills, verify every excerpt against `text`, return (sections, unsupported_claims).

    Used for both AI output and human corrections so the rules are identical.
    """
    claims: list[dict] = []
    prev = {(s.get("normalized_name") or "").lower(): s for s in (previous or [])}

    skills, seen = [], set()
    for s in (data.get("skills") or [])[:MAX_SKILLS]:
        raw = (s.get("name") or "").strip()
        if not raw:
            continue
        norm = normalize_skill(raw)
        key = norm.lower()
        if key in seen:
            continue
        seen.add(key)
        ex = (s.get("evidence_excerpt") or "").strip()[:500]
        ok = bool(ex) and verify_skill(raw, norm, ex, text)
        entry = {"name": raw, "normalized_name": norm, "evidence_excerpt": ex if ok else "", "verified": ok, "edited_by": editor}
        old = prev.get(key)
        if old and old.get("name") == raw and old.get("evidence_excerpt") == entry["evidence_excerpt"]:
            entry["edited_by"] = old.get("edited_by", editor)  # unchanged entries keep their original author
        skills.append(entry)
        if not ok:
            claims.append({"claim": f"Skill: {raw}", "reason": NO_EXCERPT if not ex else NOT_FOUND})

    education = []
    for e in (data.get("education") or [])[:MAX_ITEMS]:
        ex, reason = _check_excerpt(e.get("evidence_excerpt"), text)
        item = {"degree": e.get("degree") or "", "institution": e.get("institution") or "", "year": e.get("year"), "evidence_excerpt": ex}
        education.append(item)
        if reason:
            claims.append({"claim": f"Education: {item['degree']} {item['institution']}".strip(), "reason": reason})

    experience = []
    for e in (data.get("experience") or [])[:MAX_ITEMS]:
        ex, reason = _check_excerpt(e.get("evidence_excerpt"), text)
        years = _years_between(e.get("start"), e.get("end"))
        item = {
            "title": e.get("title") or "", "company": e.get("company") or "",
            "start": e.get("start"), "end": e.get("end"),
            "years": years if years is not None else e.get("years"),
            "summary": e.get("summary") or "", "evidence_excerpt": ex,
        }
        experience.append(item)
        if reason:
            claims.append({"claim": f"Experience: {item['title']} at {item['company']}".strip(), "reason": reason})

    projects = []
    for p in (data.get("projects") or [])[:MAX_ITEMS]:
        ex, reason = _check_excerpt(p.get("evidence_excerpt"), text)
        item = {
            "name": p.get("name") or "", "description": p.get("description") or "",
            "technologies": [str(t).strip() for t in (p.get("technologies") or []) if str(t).strip()][:30],
            "evidence_excerpt": ex,
        }
        projects.append(item)
        if reason:
            claims.append({"claim": f"Project: {item['name']}", "reason": reason})

    return {"skills": skills, "education": education, "experience": experience, "projects": projects}, claims


# ---------- persistence helpers ----------
def get_resume(db: Session, candidate_id: int) -> Resume | None:
    return db.scalar(select(Resume).where(Resume.candidate_id == candidate_id))


def _reset(resume: Resume) -> None:
    resume.parse_status = "pending"
    resume.error_message = None
    resume.raw_text = ""
    resume.name = resume.email = resume.phone = None
    resume.links, resume.skills, resume.education = [], [], []
    resume.experience, resume.projects, resume.unsupported_claims = [], [], []


def _finish(db: Session, resume: Resume, status: str, error: str | None) -> Resume:
    resume.parse_status = status
    resume.error_message = error
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


def process_upload(db: Session, user: User, filename: str | None, data: bytes) -> Resume:
    """File-level problems raise AppError (413/415/422). Content problems are stored as a parse_status."""
    validate_upload(filename, data)
    resume = get_resume(db, user.id) or Resume(candidate_id=user.id)
    _reset(resume)
    try:
        text = extract_text(data)
    except PdfError as exc:
        return _finish(db, resume, "failed", f"[{exc.code}] {exc.message}")
    if not text:
        return _finish(
            db, resume, "empty",
            "[NO_TEXT_FOUND] No readable text was found. The PDF may be a scanned image; please upload a text-based PDF.",
        )
    resume.raw_text = text
    resume.email, resume.phone, resume.links = extract_contacts(text)
    db.add(resume)
    db.commit()
    return parse_stored_text(db, resume)


def parse_stored_text(db: Session, resume: Resume) -> Resume:
    text = resume.raw_text
    if not text:
        return _finish(db, resume, "empty", "[NO_TEXT_FOUND] No readable text is stored for this resume.")
    try:
        parsed = llm.generate_json(
            model=settings.groq_model_extract,
            system=_SYSTEM,
            user=f"RESUME TEXT:\n{text[:20000]}",
            schema=_LLMResume,
        )
    except AppError as exc:
        return _finish(db, resume, "failed", f"[{exc.code}] {exc.detail}")
    except Exception as exc:  # noqa: BLE001 - never crash an upload; log the type only
        logger.error("Resume parsing failed: %s", type(exc).__name__)
        return _finish(db, resume, "failed", "[PARSE_ERROR] Unexpected error while parsing. Please retry.")

    structured, claims = build_structured(parsed.model_dump(), text, editor="ai")
    name = parsed.name or None
    if name and not verify_excerpt(name, text):
        claims.insert(0, {"claim": f"Name: {name}", "reason": "Name was not found in the resume text"})
        name = None
    resume.name = name
    resume.skills = structured["skills"]
    resume.education = structured["education"]
    resume.experience = structured["experience"]
    resume.projects = structured["projects"]
    resume.unsupported_claims = claims
    return _finish(db, resume, "parsed", None)


def reparse(db: Session, resume: Resume) -> Resume:
    """Retry AI parsing from the stored text after a failure (e.g. Groq timeout)."""
    if resume.parse_status != "failed":
        raise AppError(409, "RESUME_NOT_RETRYABLE", "Only a failed parse can be retried")
    text, email, phone, links = resume.raw_text, resume.email, resume.phone, resume.links
    _reset(resume)
    resume.raw_text, resume.email, resume.phone, resume.links = text, email, phone, links
    return parse_stored_text(db, resume)


def apply_corrections(db: Session, resume: Resume, body: ResumeCorrectionIn, editor: str = "candidate") -> Resume:
    """Replace sections the caller sent, re-verify everything, recompute unsupported_claims."""
    fields = body.model_dump(exclude_unset=True)
    current = {"skills": resume.skills, "education": resume.education, "experience": resume.experience, "projects": resume.projects}
    merged = {k: (fields[k] if fields.get(k) is not None else current[k]) for k in current}
    structured, claims = build_structured(merged, resume.raw_text or "", editor=editor, previous=resume.skills)

    if "name" in fields:
        resume.name = (fields["name"] or "").strip() or None
    if "email" in fields:
        resume.email = fields["email"]
    if "phone" in fields:
        resume.phone = (fields["phone"] or "").strip() or None
    if "links" in fields:
        resume.links = [str(x).strip()[:300] for x in (fields["links"] or []) if str(x).strip()]
    resume.skills = structured["skills"]
    resume.education = structured["education"]
    resume.experience = structured["experience"]
    resume.projects = structured["projects"]
    resume.unsupported_claims = claims
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume