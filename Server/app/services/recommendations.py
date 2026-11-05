"""Resume-to-job recommendations for a candidate.

Scores come from the same computed path as assessments (embeddings + verified evidence, personal attributes
stripped). The `reason` is built in code from those computed facts (no LLM call per job), so it can never
contradict the score. Jobs where no skill has any evidence are skipped, and jobs already applied to are excluded.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.job import Job
from app.models.user import User
from app.schemas.talent import RecommendationOut
from app.services import applications as apps_svc
from app.services import jobs as jobs_svc
from app.services import resumes

MAX_JOBS_SCORED = 50  # newest open jobs only; plenty at hackathon scale


def _reason(computed: dict) -> str:
    required = [r for r in computed["skill_results"] if r["required"]]
    confirmed = [r["skill"] for r in required if r["state"] == "confirmed"]
    missing = [r["skill"] for r in sorted(required, key=lambda r: -r["importance"]) if r["state"] == "no_evidence_found"]
    if required:
        shown = f" ({', '.join(confirmed[:4])})" if confirmed else ""
        parts = [f"Your resume shows evidence for {len(confirmed)} of {len(required)} required skills{shown}."]
    else:
        parts = ["This role lists no required skills; the match is based on your overall profile."]
    if missing:
        parts.append(f"No evidence was found yet for {', '.join(missing[:3])}; adding it to your resume could strengthen the match.")
    return " ".join(parts)


def recommend(db: Session, user: User, limit: int) -> list[RecommendationOut]:
    resume = resumes.get_resume(db, user.id)  # always the logged-in candidate's own resume
    if resume is None or resume.parse_status != "parsed":
        return []
    data = apps_svc.snapshot_resume(resume)
    applied = select(Application.job_id).where(Application.candidate_id == user.id)
    jobs = db.scalars(
        select(Job).where(Job.status == "open", Job.id.not_in(applied))
        .order_by(Job.created_at.desc(), Job.id.desc()).limit(MAX_JOBS_SCORED)
    ).all()

    scored = []
    for job in jobs:
        computed = apps_svc.compute_scores(job, data, resume.raw_text)
        if not apps_svc.has_skill_evidence(computed):
            continue
        matched = [r["skill"] for r in computed["skill_results"] if r["state"] == "confirmed"]
        scored.append((computed["overall_score"], len(matched), job, matched, computed))
    scored.sort(key=lambda t: (-t[0], -t[1], -t[2].id))

    return [
        RecommendationOut(job=jobs_svc.to_out(job, 0), match_score=score, matched_skills=matched, reason=_reason(computed))
        for score, _, job, matched, computed in scored[:limit]
    ]