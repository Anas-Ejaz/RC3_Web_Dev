"""Scoring engine. ALL numbers are computed here, in code, from embeddings and verified evidence.

Weights: skills 50%, experience 25%, projects 15%, qualifications 10%.
The LLM (explain()) only writes prose from the computed facts. Candidate name, gender, age, photo,
address and nationality are never read here, so they cannot influence a score.

Evidence states per job skill:
  confirmed         - the skill is in the verified resume evidence (exact normalized match or a real resume line)
  weak_evidence     - only indirect evidence: a semantically related skill, or a project technology
                      whose excerpt does not mention it
  no_evidence_found - nothing in the resume supports it (never phrased as "lacks")
"""
import json
import logging
import re

from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.errors import AppError
from app.services import embeddings, llm
from app.services.normalize import normalize_skill, surface_forms
from app.services.verification import normalize_text

logger = logging.getLogger("app.matching")

WEIGHTS = {"skills": 0.50, "experience": 0.25, "projects": 0.15, "qualifications": 0.10}
POINTS = {"confirmed": 1.0, "weak_evidence": 0.5, "no_evidence_found": 0.0}
PREFERRED_FACTOR = 0.5  # preferred skills count half as much as required ones
SEMANTIC_WEAK = 0.78  # cosine similarity needed to call a related skill "weak evidence"
QUAL_THRESHOLD = 0.72
_AMBIGUOUS = {"go", "rest", "next", "ai", "ml", "ts"}  # plain English words: too noisy for text scanning


def _patterns(skill: str) -> list[re.Pattern]:
    forms = {normalize_text(f) for f in surface_forms(skill)} - _AMBIGUOUS
    return [re.compile(rf"(?<![\w+#]){re.escape(f)}(?![\w+#])") for f in forms if f]


def _hit(patterns: list[re.Pattern], norm_text: str) -> bool:
    return any(p.search(norm_text) for p in patterns)


def _find_line(skill: str, text: str) -> str | None:
    """First real resume line that mentions the skill (or one of its aliases)."""
    pats = _patterns(skill)
    if not pats:
        return None
    for line in text.split("\n"):
        if len(line.strip()) >= 3 and _hit(pats, normalize_text(line)):
            return line.strip()[:200]
    return None


def _evidence_items(resume: dict) -> dict[str, dict]:
    """Skills the resume supports, keyed by lowercase normalized name. Unverified claims never count."""
    items: dict[str, dict] = {}

    def add(name: str, excerpt: str, confirmed: bool) -> None:
        name = normalize_skill((name or "").strip())
        if not name or not excerpt:
            return
        cur = items.get(name.lower())
        if cur is None or (confirmed and not cur["confirmed"]):
            items[name.lower()] = {"name": name, "excerpt": excerpt, "confirmed": confirmed}

    for s in resume.get("skills") or []:
        if s.get("verified"):
            add(s.get("normalized_name") or s.get("name"), s.get("evidence_excerpt") or "", True)
    for p in resume.get("projects") or []:
        excerpt = p.get("evidence_excerpt") or ""
        ex_norm = normalize_text(excerpt)
        for tech in p.get("technologies") or []:
            add(str(tech), excerpt, _hit(_patterns(str(tech)), ex_norm))
    return items


def _project_text(p: dict) -> str:
    return " ".join([p.get("name") or "", p.get("description") or "", " ".join(p.get("technologies") or [])]).strip()


def compute(job: dict, resume: dict, resume_text: str) -> dict:
    """Return the full computed assessment (without the prose explanation)."""
    job_skills = [(s["name"], int(s["importance"]), True) for s in job.get("required_skills") or []] + [
        (s["name"], int(s["importance"]), False) for s in job.get("preferred_skills") or []
    ]
    items = _evidence_items(resume)
    item_list = list(items.values())
    experience = [e for e in resume.get("experience") or [] if e.get("evidence_excerpt")]  # unverified entries do not count
    projects = [p for p in resume.get("projects") or [] if p.get("evidence_excerpt") and _project_text(p)]
    educations = [e for e in resume.get("education") or [] if e.get("evidence_excerpt")]
    quals = [q for q in job.get("qualifications") or [] if q.strip()]

    project_texts = [_project_text(p) for p in projects]
    edu_texts = [f"{e.get('degree', '')} {e.get('institution', '')}".strip() for e in educations]
    job_query = f"{job.get('title', '')}. " + ", ".join(n for n, _, _ in job_skills)

    texts = [n for n, _, _ in job_skills] + [i["name"] for i in item_list] + project_texts + [job_query] + quals + edu_texts
    uniq = list(dict.fromkeys(t for t in texts if t))
    vmap = dict(zip(uniq, embeddings.embed(uniq))) if uniq else {}

    # ---------- skills ----------
    results: list[dict] = []
    for name, importance, required in job_skills:
        exact = items.get(name.lower())
        excerpt, sim = None, 0.0
        if exact:
            state = "confirmed" if exact["confirmed"] else "weak_evidence"
            sim, excerpt = 1.0, exact["excerpt"]
        else:
            line = _find_line(name, resume_text)
            if line:
                state, sim, excerpt = "confirmed", 1.0, line
            else:
                best, best_item = 0.0, None
                for it in item_list:
                    c = embeddings.cosine(vmap[name], vmap[it["name"]])
                    if c > best:
                        best, best_item = c, it
                sim = max(0.0, min(1.0, best))
                if best_item is not None and best >= SEMANTIC_WEAK:
                    state, excerpt = "weak_evidence", best_item["excerpt"]
                else:
                    state = "no_evidence_found"
        results.append(
            {"skill": name, "importance": importance, "required": required, "state": state,
             "similarity": round(sim, 3), "evidence_excerpt": excerpt}
        )

    total_w = sum(r["importance"] * (1.0 if r["required"] else PREFERRED_FACTOR) for r in results)
    earned = sum(r["importance"] * (1.0 if r["required"] else PREFERRED_FACTOR) * POINTS[r["state"]] for r in results)
    skills_score = 100.0 * earned / total_w if total_w else 100.0

    # ---------- experience (years from verified entries; dates were converted to years in code) ----------
    years = sum(float(e["years"]) for e in experience if isinstance(e.get("years"), (int, float)))
    min_years = float(job.get("min_experience_years") or 0)
    experience_score = 100.0 if min_years <= 0 else min(1.0, years / min_years) * 100.0

    # ---------- projects: 70% skill coverage + 30% semantic closeness to the job ----------
    project_score = 0.0
    if projects:
        names = [n for n, _, _ in job_skills]
        norm_texts = [normalize_text(t) for t in project_texts]
        covered = 0
        for n in names:
            pats = _patterns(n)
            for p, nt in zip(projects, norm_texts):
                techs = {normalize_skill(str(t)).lower() for t in p.get("technologies") or []}
                if n.lower() in techs or _hit(pats, nt):
                    covered += 1
                    break
        coverage = covered / len(names) if names else 0.0
        best_sim = max(embeddings.cosine(vmap[job_query], vmap[t]) for t in project_texts)
        semantic = min(1.0, max(0.0, (best_sim - 0.5) / 0.3))
        project_score = 100.0 * (0.7 * coverage + 0.3 * semantic)

    # ---------- qualifications ----------
    unmatched_quals: list[str] = []
    if quals:
        edu_blob = normalize_text(" ".join(edu_texts))
        matched = 0
        for q in quals:
            best = max((embeddings.cosine(vmap[q], vmap[t]) for t in edu_texts), default=0.0)
            if normalize_text(q) in edu_blob or best >= QUAL_THRESHOLD:
                matched += 1
            else:
                unmatched_quals.append(q)
        qualification_score = 100.0 * matched / len(quals)
    else:
        qualification_score = 100.0

    raw = {"skills": skills_score, "experience": experience_score, "projects": project_score, "qualifications": qualification_score}
    overall = sum(WEIGHTS[k] * raw[k] for k in WEIGHTS)

    # ---------- gaps (wording: "no evidence found", never "lacks") ----------
    gaps: list[str] = []
    for r in sorted(results, key=lambda x: -x["importance"]):
        if r["required"] and r["state"] == "no_evidence_found":
            gaps.append(f"No evidence found for required skill: {r['skill']}")
        elif r["required"] and r["state"] == "weak_evidence":
            gaps.append(f"Only weak evidence for required skill: {r['skill']}")
    if min_years > 0 and years < min_years:
        gaps.append(f"Documented experience (about {years:g} years) is below the {min_years:g} years requested")
    for q in unmatched_quals:
        gaps.append(f"No evidence found for qualification: {q}")

    return {
        "overall_score": round(overall, 1),
        "breakdown": {k: {"score": round(raw[k], 1), "weight": WEIGHTS[k]} for k in WEIGHTS},
        "skill_results": results,
        "gaps": gaps,
        "unsupported_claims": resume.get("unsupported_claims") or [],
        "experience_years": round(years, 1),
    }


# ---------- LLM: prose only, from computed facts ----------
class _Explanation(BaseModel):
    explanation: str = ""
    learning_suggestions: list[str] = Field(default_factory=list)


_EXPLAIN_SYSTEM = """You write a short, neutral explanation of an automated resume-to-job match for a recruiter.
You receive JSON with scores and evidence states that were ALREADY computed. Output JSON:
{"explanation": string (3-5 sentences), "learning_suggestions": [string] (up to 5, concrete things to learn or show evidence of)}
Rules:
- Do not change, recompute or invent any numbers or facts. Use only what is in the input.
- Never say a candidate "lacks" a skill. Say "no evidence was found" or "only weak evidence was found".
- Mention that the result is a recommendation and that a human makes the decision.
- Never refer to or guess personal attributes (gender, age, nationality, ethnicity, name, appearance)."""


def explain(job_title: str, computed: dict) -> dict:
    """Explanation + learning suggestions. On any AI failure, returns a clear notice instead of crashing."""
    facts = {
        "job_title": job_title,
        "overall_score": computed["overall_score"],
        "breakdown": {k: v["score"] for k, v in computed["breakdown"].items()},
        "skills": [{"skill": r["skill"], "required": r["required"], "importance": r["importance"], "evidence": r["state"]}
                   for r in computed["skill_results"]],
        "gaps": computed["gaps"],
        "documented_experience_years": computed["experience_years"],
    }
    try:
        out = llm.generate_json(
            model=settings.groq_model_explain, system=_EXPLAIN_SYSTEM,
            user=json.dumps(facts), schema=_Explanation, temperature=0.2,
        )
        return {
            "explanation": out.explanation.strip()[:2000],
            "learning_suggestions": [s.strip()[:300] for s in out.learning_suggestions if s.strip()][:6],
        }
    except AppError as exc:
        logger.warning("Explanation unavailable: %s", exc.code)
        return {
            "explanation": f"AI explanation is unavailable ({exc.code}). The scores above were computed from resume evidence; use Reassess to retry.",
            "learning_suggestions": [],
        }