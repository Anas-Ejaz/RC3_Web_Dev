"""Fairness test: perturb personal attributes, re-score through the REAL scoring path, report deltas.

Each variant changes one attribute in the stored resume data AND injects it into the resume text
(a swapped name, "Gender: Female", "Age: 58", a different address, ...). The variant then goes through
applications.compute_scores(), the same function real assessments use. If stripping or scoring ever
let an attribute influence the score, the delta is non-zero and the test fails.
No LLM is called: only the computed score is compared.
"""
import re
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.user import User
from app.schemas.fairness import FairnessOut, VariantOut
from app.services import applications as apps_svc

TOLERANCE = 0.5  # score points; expected delta is exactly 0.0

Perturb = Callable[[dict, str], tuple[dict, str]]


def _swap_name(new: str) -> Perturb:
    def apply(resume: dict, text: str) -> tuple[dict, str]:
        old = (resume.get("name") or "").strip()
        out = re.sub(re.escape(old), lambda _: new, text, flags=re.I) if len(old) >= 3 else text
        if new.lower() not in out.lower():  # name was not in the text: put it at the top like a CV header
            out = f"{new}\n{out}"
        return {**resume, "name": new}, out

    return apply


def _inject(extra: dict, *lines: str) -> Perturb:
    def apply(resume: dict, text: str) -> tuple[dict, str]:
        return {**resume, **extra}, "\n".join(lines) + "\n" + text

    return apply


PERTURBATIONS: dict[str, list[tuple[str, Perturb]]] = {
    "name": [(n, _swap_name(n)) for n in ("Emily Johnson", "Muhammad Ali Khan")],
    "gender": [
        (g, _inject({"gender": g}, f"Gender: {g.title()}", f"Pronouns: {p}"))
        for g, p in (("female", "she/her"), ("male", "he/him"), ("non-binary", "they/them"))
    ],
    "age": [(str(a), _inject({"age": a}, f"Age: {a}", f"Date of Birth: 14 March {2026 - a}")) for a in (24, 58)],
    "location": [
        (c, _inject({"location": c, "address": c}, f"Location: {c}", f"Address: 14 Main Street, {c}"))
        for c in ("Lagos, Nigeria", "Zurich, Switzerland")
    ],
    "nationality": [(n, _inject({"nationality": n}, f"Nationality: {n}")) for n in ("Nigerian", "Swiss")],
}


def run_test(db: Session, user: User, application_id: int, attributes: list[str]) -> FairnessOut:
    app = apps_svc.get_owned_application(db, application_id, user)  # 404 unless the recruiter owns the job
    job = db.get(Job, app.job_id)

    def score(resume: dict, text: str) -> float:
        return apps_svc.compute_scores(job, resume, text)["overall_score"]

    original = score(app.resume_data, app.resume_text)
    variants: list[VariantOut] = []
    for attribute in dict.fromkeys(attributes):  # de-duplicate, keep order
        for label, perturb in PERTURBATIONS[attribute]:
            resume, text = perturb(app.resume_data, app.resume_text)
            s = score(resume, text)
            variants.append(VariantOut(attribute=attribute, changed_to=label, score=s, delta=round(s - original, 2)))

    max_delta = max((abs(v.delta) for v in variants), default=0.0)
    return FairnessOut(original_score=original, variants=variants, passed=max_delta <= TOLERANCE,
                       max_abs_delta=round(max_delta, 2), tolerance=TOLERANCE)