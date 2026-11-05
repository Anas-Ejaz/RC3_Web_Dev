"""Seed demo data through the REAL pipeline (real Groq, real fastembed, real scoring). No hardcoded AI output.

Run from the Server folder:
    python -m scripts.seed              # idempotent: safe to run twice
    python -m scripts.seed --reset      # delete ONLY the demo users (@demo.example.com) and their data, then seed again
    python -m scripts.seed --reset --no-seed

How it works: the script drives the real FastAPI routers in-process (TestClient on the real database), so every
resume parse, assessment, status change, question set and interview goes through the same services as the API.
DEMO ONLY: never run against a production database (it refuses unless --allow-production).
"""
import argparse
import os
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import pymupdf
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine
from app.main import app
from app.models.application import Application
from app.models.candidate import Resume
from app.models.job import Job
from app.models.user import User

# ---------------------------------------------------------------- configuration
DEMO_DOMAIN = "demo.example.com"  # not ".local": email-validator rejects reserved names
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "Demo-Str0ng-Pass1")  # DEMO ONLY. Override with env DEMO_PASSWORD.
P = settings.api_prefix

# Endpoints I could not verify (see checkpoint). Adjust here if the startup check prints [skip]/[warn].
RESUME_UPLOAD = ("POST", "/candidate/resume")                       # multipart field "file"
QUESTIONS = ("POST", "/applications/{application_id}/questions/generate")
QUESTIONS_BODY = {"technical": 2, "hr": 2, "managerial": 1, "include_project": True}  # 2/2/1 + project
INTERVIEW = ("POST", "/interviews")
NOTE = ("POST", "/applications/{application_id}/notes")

RECRUITER = ("recruiter@" + DEMO_DOMAIN, "Rita Recruiter", "recruiter")
INTERVIEWER = ("interviewer@" + DEMO_DOMAIN, "Ivan Interviewer", "recruiter")
CANDIDATES = [
    ("strong@" + DEMO_DOMAIN, "Ayesha Strong"),
    ("partial@" + DEMO_DOMAIN, "Bilal Partial"),
    ("weak@" + DEMO_DOMAIN, "Chen Weak"),
]

JOB = {
    "title": "Backend Developer", "department": "Engineering", "location": "Remote", "type": "full_time",
    "description": "Build and operate the APIs behind our hiring platform.",
    "required_skills": [
        {"name": "Python", "importance": 5}, {"name": "Django", "importance": 5},
        {"name": "PostgreSQL", "importance": 4}, {"name": "Docker", "importance": 3},
    ],
    "preferred_skills": [{"name": "Redis", "importance": 2}],
    "min_experience_years": 2,
    "qualifications": ["Bachelor's degree in Computer Science or equivalent experience"],
}

RESUMES = {
    "strong": [
        "# Ayesha Strong", "Email: strong@demo.example.com | Phone: +92 300 1111111",
        "Age: 31", "Gender: Female",  # personal attributes: stripped before scoring
        "# Skills", "Skills: Python, Django, PostgreSQL, Docker, Redis, REST APIs, Git",
        "# Experience",
        "Senior Backend Developer, Northwind Labs, 2020 - 2024 (4 years)",
        "Built Django REST services backed by PostgreSQL serving 2M requests per day.",
        "Containerised all services with Docker and automated deployments.",
        "# Projects",
        "Order Tracker API: Django and PostgreSQL service with Redis caching, deployed with Docker Compose.",
        "Job Board: Python and Django application with full-text search in PostgreSQL.",
        "# Education", "BSc Computer Science, 2019",
    ],
    "partial": [
        "# Bilal Partial", "Email: partial@demo.example.com | Phone: +92 300 2222222",
        "# Skills", "Skills: Python, Django, SQLite, Git, HTML",
        "# Experience",
        "Junior Python Developer, Brightside Software, 2021 - 2023 (2.5 years)",
        "Developed Django views, forms and admin tools for internal dashboards.",
        "# Projects",
        "Inventory Manager: Django app using SQLite. Containerized the app with Docker for local development.",
        "# Education", "BS Software Engineering, 2020",
    ],
    "weak": [
        "# Chen Weak", "Email: weak@demo.example.com | Phone: +92 300 3333333",
        "# Skills", "Skills: React, TypeScript, JavaScript, CSS, Figma",
        "# Experience",
        "Frontend Developer, Pixel Studio, 2021 - 2023 (2 years)",
        "Built React component libraries and dashboards in TypeScript.",
        "Wrote small Python scripts for cleaning CSV exports.",
        "# Projects",
        "Portfolio Site: React and TypeScript single page application.",
        "# Education", "BA Design, 2020",
    ],
}


# ---------------------------------------------------------------- helpers
@lru_cache
def _paths() -> dict:
    return app.openapi().get("paths", {})


def _norm(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "{}", path)


def _has(method: str, tmpl: str) -> bool:
    want = _norm(P + tmpl)
    return any(_norm(p) == want and method.lower() in ops for p, ops in _paths().items())


def _step(label, client, method, tmpl, ids=None, expected=(200, 201), **kw):
    """Call one real endpoint. Never raises: prints [ok]/[skip]/[warn] and returns the response or None."""
    if not _has(method, tmpl):
        print(f"  [skip] {label}: route {method} {P}{tmpl} not found. Fix the constant at the top of scripts/seed.py")
        return None
    r = client.request(method, P + tmpl.format(**(ids or {})), **kw)
    if r.status_code not in expected:
        print(f"  [warn] {label}: HTTP {r.status_code} {r.text[:200]}")
        return None
    print(f"  [ok]   {label}")
    return r


def _make_pdf(path: Path, lines: list[str]) -> None:
    """Write a REAL text PDF (ASCII only, base-14 font) so extraction works like any uploaded resume."""
    doc = pymupdf.open()
    page = doc.new_page()
    y = 60
    for line in lines:
        if y > 780:
            page, y = doc.new_page(), 60
        heading = line.startswith("# ")
        page.insert_text((50, y), line[2:] if heading else line, fontsize=13 if heading else 10, fontname="helv")
        y += 22 if heading else 14
    doc.save(str(path))
    doc.close()


def _client_for(email: str, name: str, role: str) -> TestClient:
    c = TestClient(app, base_url="https://testserver")  # https so Secure cookies are sent back
    r = c.post(f"{P}/auth/register", json={"email": email, "password": DEMO_PASSWORD, "full_name": name, "role": role})
    if r.status_code != 201:  # already exists: log in
        r = c.post(f"{P}/auth/login", json={"email": email, "password": DEMO_PASSWORD})
        if r.status_code != 200:
            raise SystemExit(f"Cannot register or log in {email} (HTTP {r.status_code}). "
                             f"Wrong DEMO_PASSWORD for an existing demo user? Try: python -m scripts.seed --reset")
    return c


def _uid(db: Session, email: str) -> int | None:
    return db.scalar(select(User.id).where(User.email == email))


# ---------------------------------------------------------------- reset
def reset() -> None:
    """Delete ONLY demo users (email domain) and what hangs off them. Other data is untouched."""
    with Session(engine) as db:
        ids = list(db.scalars(select(User.id).where(User.email.like(f"%@{DEMO_DOMAIN}"))))
        if not ids:
            print("No demo users found, nothing to reset.")
            return
        try:
            db.execute(delete(Job).where(Job.recruiter_id.in_(ids)))  # applications etc. cascade from jobs
            db.execute(delete(User).where(User.id.in_(ids)))          # resumes, profiles, notifications cascade
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise SystemExit("Reset blocked by a foreign key (a table that does not cascade from users/jobs). "
                             f"Nothing was deleted. Detail: {type(exc.orig).__name__}") from exc
        print(f"Deleted {len(ids)} demo users and their jobs/applications.")


# ---------------------------------------------------------------- summary
def summary() -> None:
    with Session(engine) as db:
        job = db.scalar(select(Job).join(User, User.id == Job.recruiter_id)
                        .where(User.email == RECRUITER[0], Job.title == JOB["title"]))
        if job is None:
            return
        print("\n=== RESULTS (computed in code from embeddings and evidence) ===")
        rows = db.execute(
            select(Application, User.email, User.full_name).join(User, User.id == Application.candidate_id)
            .where(Application.job_id == job.id).order_by(Application.score.desc())).all()
        for application, email, name in rows:
            print(f"\n{name} <{email}>  score={application.score}  status={application.status}")
            for r in (application.assessment or {}).get("skill_results", []):
                state = "no evidence found" if r["state"] == "no_evidence_found" else r["state"]
                print(f"    {r['skill']:<12} {'required' if r.get('required') else 'preferred':<9} {state}")
        scores = [a.score for a, _, _ in rows if a.score is not None]
        if len(set(scores)) < len(scores):
            print("\nWARNING: two candidates share the same score; check the assessment output.")


def credentials() -> None:
    print("\n=== DEMO CREDENTIALS (DEMO ONLY, never use in production) ===")
    print(f"  password for all demo accounts: {DEMO_PASSWORD}   (change with env DEMO_PASSWORD)")
    for email, name, role in [RECRUITER, INTERVIEWER]:
        print(f"  {role:<10} {email:<34} {name}")
    for email, name in CANDIDATES:
        print(f"  candidate  {email:<34} {name}")


# ---------------------------------------------------------------- seed
def seed() -> None:
    if not settings.groq_api_key:
        print("GROQ_API_KEY is not set. The seed uses the REAL AI pipeline (no fake output), so it cannot run.\n"
              "Set GROQ_API_KEY in .env and run again.")
        sys.exit(1)

    print("Checking assumed endpoints...")
    for label, (method, tmpl) in {"resume upload": RESUME_UPLOAD, "questions": QUESTIONS,
                                  "interview": INTERVIEW, "note": NOTE}.items():
        print(f"  {'ok  ' if _has(method, tmpl) else 'MISSING'} {label}: {method} {P}{tmpl}")

    print("\nAccounts")
    rec_c = _client_for(*RECRUITER)
    _client_for(*INTERVIEWER)
    cand_clients = {email: _client_for(email, name, "candidate") for email, name in CANDIDATES}

    with Session(engine) as db:
        rec_id, interviewer_id = _uid(db, RECRUITER[0]), _uid(db, INTERVIEWER[0])
        job_id = db.scalar(select(Job.id).where(Job.recruiter_id == rec_id, Job.title == JOB["title"]))

    print("\nJob")
    if job_id is None:
        r = _step("create job 'Backend Developer'", rec_c, "POST", "/jobs", expected=(201,), json=JOB)
        if r is None:
            raise SystemExit("Could not create the job; cannot continue.")
        job_id = r.json()["id"]
    else:
        print("  [ok]   job already exists")

    print("\nResumes (real PDFs, real parsing)")
    tmp = Path(tempfile.mkdtemp(prefix="demo_resumes_"))
    for (email, _), key in zip(CANDIDATES, ("strong", "partial", "weak")):
        with Session(engine) as db:
            uid = _uid(db, email)
            parsed = db.scalar(select(Resume.id).where(Resume.candidate_id == uid, Resume.parse_status == "parsed"))
        if parsed:
            print(f"  [ok]   {key}: resume already parsed")
            continue
        pdf = tmp / f"{key}_resume.pdf"
        _make_pdf(pdf, RESUMES[key])
        with open(pdf, "rb") as fh:
            r = _step(f"upload {key} resume", cand_clients[email], RESUME_UPLOAD[0], RESUME_UPLOAD[1],
                      expected=(200, 201), files={"file": (pdf.name, fh, "application/pdf")})
        if r is not None and r.json().get("parse_status") != "parsed":
            print(f"         parse_status={r.json().get('parse_status')}: {r.json().get('error_message')}")

    print("\nApplications (real assessment: embeddings + evidence verification)")
    for email, _ in CANDIDATES:
        with Session(engine) as db:
            exists = db.scalar(select(Application.id).where(Application.job_id == job_id,
                                                            Application.candidate_id == _uid(db, email)))
        if exists:
            print(f"  [ok]   {email.split('@')[0]} already applied")
        else:
            _step(f"apply {email.split('@')[0]}", cand_clients[email], "POST", "/jobs/{job_id}/apply",
                  {"job_id": job_id}, expected=(201,))

    with Session(engine) as db:
        rows = db.execute(select(Application.id, Application.status, Application.score, User.email)
                          .join(User, User.id == Application.candidate_id)
                          .where(Application.job_id == job_id)).all()
    apps = {email: (aid, status, score) for aid, status, score, email in rows}
    if len(apps) < 3 or any(v[2] is None for v in apps.values()):
        print("\nNot every application has a score yet (check warnings above). Stopping before the review steps.")
        summary()
        credentials()
        return

    best_email = max(apps, key=lambda e: apps[e][2])
    best_id, best_status, _ = apps[best_email]
    weak_id, weak_status, _ = apps[CANDIDATES[2][0]]
    partial_id, partial_status, _ = apps[CANDIDATES[1][0]]
    done = ("shortlisted", "interview", "recruiter_review", "rejected", "selected", "not_selected")

    print("\nRecruiter review (manual, audited status changes)")
    if best_status not in done:
        _step("shortlist best-scored candidate", rec_c, "POST", "/applications/{application_id}/status",
              {"application_id": best_id}, expected=(200,),
              json={"to_status": "shortlisted", "reason": "Highest computed score with verified Python, Django, PostgreSQL and Docker evidence."})
        _step("generate interview questions (2/2/1 + project)", rec_c, QUESTIONS[0], QUESTIONS[1],
              {"application_id": best_id}, json=QUESTIONS_BODY)
        when = (datetime.now(timezone.utc) + timedelta(days=2)).replace(minute=0, second=0, microsecond=0)
        _step("schedule interview in 2 days with second recruiter", rec_c, INTERVIEW[0], INTERVIEW[1],
              expected=(200, 201),
              json={"application_id": best_id, "interviewer_id": interviewer_id, "scheduled_at": when.isoformat(),
                    "duration_minutes": 45, "type": "technical", "location": "Online"})
        _step("add private note", rec_c, NOTE[0], NOTE[1], {"application_id": best_id},
              json={"text": "Strong backend profile. Ask about PostgreSQL indexing and Docker deployment."})
    else:
        print("  [ok]   best candidate already reviewed (use --reset to redo the flow)")
    if weak_status not in done:
        _step("reject weak match with reason", rec_c, "POST", "/applications/{application_id}/status",
              {"application_id": weak_id}, expected=(200,),
              json={"to_status": "rejected", "reason": "Frontend-focused profile, different role."})
    if partial_status not in done:
        _step("move partial match to recruiter_review", rec_c, "POST", "/applications/{application_id}/status",
              {"application_id": partial_id}, expected=(200,),
              json={"to_status": "recruiter_review", "reason": "Needs follow-up on database experience."})

    print("\nTalent pool consent")
    _step("partial-match candidate opts in", cand_clients[CANDIDATES[1][0]], "PUT", "/candidate/talent-pool-consent",
          expected=(200,), json={"consent": True})

    summary()
    credentials()
    print("\nTip: create a second job as the recruiter, then GET /talent/pool?job_id=<new job> to see the pool.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data through the real pipeline.")
    parser.add_argument("--reset", action="store_true", help="delete only demo users (@%s) first" % DEMO_DOMAIN)
    parser.add_argument("--no-seed", action="store_true", help="with --reset: only delete, do not seed again")
    parser.add_argument("--allow-production", action="store_true", help="override the production guard")
    args = parser.parse_args()
    if settings.is_production and not args.allow_production:
        raise SystemExit("ENVIRONMENT=production: refusing to create demo accounts. Use --allow-production if you really mean it.")
    if args.reset:
        reset()
    if not args.no_seed:
        seed()


if __name__ == "__main__":
    main()