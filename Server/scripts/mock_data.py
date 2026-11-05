"""Bulk MOCK data for UI/analytics testing. DEMO ONLY.

Users, jobs, applications, status changes and consent go through the real API (real scoring, real fastembed).
Resumes are inserted directly (structured data + matching raw text, so evidence verification passes).
The ONLY fake part is the assessment explanation sentence (Groq is not called): it is labelled as demo data.

    python -m scripts.mock_data            # idempotent
    python -m scripts.mock_data --reset    # delete only @mock.example.com users (and their jobs), then recreate
"""
import argparse
import os
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine
from app.main import app
from app.models.candidate import Resume
from app.models.job import Job
from app.models.user import User

DOMAIN = "mock.example.com"
PW = os.getenv("DEMO_PASSWORD", "Demo-Str0ng-Pass1")
P = settings.api_prefix

RECRUITERS = [("recruiter1@" + DOMAIN, "Rita Recruiter"), ("recruiter2@" + DOMAIN, "Omar Recruiter")]

JOBS = [  # (recruiter index, title, required skills with importance, preferred, min years)
    (0, "Backend Developer", {"Python": 5, "Django": 5, "PostgreSQL": 4, "Docker": 3}, {"Redis": 2}, 2),
    (0, "Frontend Developer", {"React": 5, "TypeScript": 4, "CSS": 3}, {"Next.js": 2}, 2),
    (0, "Data Engineer", {"Python": 5, "SQL": 5, "Airflow": 3, "AWS": 3}, {}, 3),
    (1, "DevOps Engineer", {"Docker": 5, "Kubernetes": 5, "AWS": 4, "Terraform": 3}, {}, 3),
]

CANDIDATES = [  # (name, title, company, years, skills)
    ("Ayesha Khan", "Senior Backend Developer", "Northwind", 5, ["Python", "Django", "PostgreSQL", "Docker", "Redis"]),
    ("Bilal Ahmed", "Python Developer", "Brightside", 3, ["Python", "Django", "SQLite", "Git"]),
    ("Chen Wei", "Frontend Developer", "Pixel Studio", 4, ["React", "TypeScript", "JavaScript", "CSS", "Next.js"]),
    ("Dana Ortiz", "Data Engineer", "Lakehouse", 4, ["Python", "SQL", "Airflow", "AWS", "PostgreSQL"]),
    ("Emre Yilmaz", "DevOps Engineer", "CloudNine", 6, ["Docker", "Kubernetes", "AWS", "Terraform", "Linux"]),
    ("Fatima Noor", "Full Stack Developer", "Orbit", 3, ["Python", "React", "PostgreSQL", "Docker"]),
    ("Greg Miller", "Junior Developer", "Startup Co", 1, ["JavaScript", "HTML", "CSS"]),
    ("Hina Sheikh", "Backend Developer", "Delta Tech", 2, ["Python", "Django", "PostgreSQL"]),
]

# (candidate index, job title, target status or None, reason, consent)
APPLICATIONS = [
    (0, "Backend Developer", "shortlisted", "Verified Python, Django, PostgreSQL and Docker.", True),
    (1, "Backend Developer", "recruiter_review", "Needs follow-up on database experience.", False),
    (7, "Backend Developer", "rejected", "Below the experience requirement.", True),
    (5, "Backend Developer", None, "", False),
    (2, "Frontend Developer", "shortlisted", "Strong React and TypeScript evidence.", True),
    (6, "Frontend Developer", "rejected", "Too junior for this role.", False),
    (3, "Data Engineer", "recruiter_review", "Good SQL and Airflow evidence.", True),
    (0, "Data Engineer", None, "", False),
    (4, "DevOps Engineer", "shortlisted", "Kubernetes and Terraform experience confirmed.", True),
    (5, "DevOps Engineer", "not_selected", "Another candidate fit better.", False),
]


def _resume_parts(title, company, years, skills):
    head = f"Skills: {', '.join(skills)}"
    exp_line = f"{title} at {company}, {2026 - int(years)} - 2026 ({years} years)"
    text = "\n".join([head, exp_line, f"Worked with {', '.join(skills[:3])} in production.",
                     f"Project: built a service using {skills[0]}."])
    sk = lambda s: {"name": s, "normalized_name": s, "evidence_excerpt": head, "verified": True, "edited_by": "ai"}
    data = {
        "skills": [sk(s) for s in skills], "education": [], "projects": [], "unsupported_claims": [],
        "experience": [{"title": title, "company": company, "start": str(2026 - int(years)), "end": "2026",
                        "years": float(years), "summary": "", "evidence_excerpt": exp_line}],
    }
    return text, data


def _client(email, name, role):
    c = TestClient(app, base_url="https://testserver")
    r = c.post(f"{P}/auth/register", json={"email": email, "password": PW, "full_name": name, "role": role})
    if r.status_code != 201:
        r = c.post(f"{P}/auth/login", json={"email": email, "password": PW})
        if r.status_code != 200:
            raise SystemExit(f"Cannot log in {email}: HTTP {r.status_code}. Try --reset.")
    return c


def reset():
    with Session(engine) as db:
        ids = list(db.scalars(select(User.id).where(User.email.like(f"%@{DOMAIN}"))))
        if ids:
            db.execute(delete(Job).where(Job.recruiter_id.in_(ids)))
            db.execute(delete(User).where(User.id.in_(ids)))
            db.commit()
        print(f"Deleted {len(ids)} mock users.")


def _placeholder_llm(**kw):  # DEMO ONLY: replaces the Groq call for the explanation text
    return kw["schema"].model_validate({
        "explanation": "Demo data: explanation text was not generated by the AI. Scores are computed in code.",
        "learning_suggestions": [],
    })


def seed():
    rec = [_client(e, n, "recruiter") for e, n in RECRUITERS]
    cands = [_client(f"cand{i + 1}@{DOMAIN}", c[0], "candidate") for i, c in enumerate(CANDIDATES)]

    job_ids = {}
    with Session(engine) as db:
        for ri, title, req, pref, years in JOBS:
            owner = db.scalar(select(User.id).where(User.email == RECRUITERS[ri][0]))
            existing = db.scalar(select(Job.id).where(Job.recruiter_id == owner, Job.title == title))
            if existing:
                job_ids[title] = existing
                continue
            body = {"title": title, "department": "Engineering", "location": "Remote", "type": "full_time",
                    "description": f"{title} for our hiring platform.", "min_experience_years": years,
                    "required_skills": [{"name": k, "importance": v} for k, v in req.items()],
                    "preferred_skills": [{"name": k, "importance": v} for k, v in pref.items()],
                    "qualifications": []}
            r = rec[ri].post(f"{P}/jobs", json=body)
            assert r.status_code == 201, r.text
            job_ids[title] = r.json()["id"]

        for i, (name, title, company, years, skills) in enumerate(CANDIDATES):
            uid = db.scalar(select(User.id).where(User.email == f"cand{i + 1}@{DOMAIN}"))
            if db.scalar(select(Resume.id).where(Resume.candidate_id == uid)):
                continue
            text, data = _resume_parts(title, company, years, skills)
            db.add(Resume(candidate_id=uid, parse_status="parsed", raw_text=text, name=name,
                          email=f"cand{i + 1}@{DOMAIN}", phone=f"+92 300 55500{i:02d}", **data))
        db.commit()

    owner_of = {t: RECRUITERS[ri][0] for ri, t, *_ in JOBS}
    with patch("app.services.llm.generate_json", _placeholder_llm):
        for ci, title, status, reason, consent in APPLICATIONS:
            jid = job_ids[title]
            r = cands[ci].post(f"{P}/jobs/{jid}/apply")
            if r.status_code == 201:
                app_id = r.json()["id"]
            elif r.status_code == 409:  # already applied
                print(f"  [ok] cand{ci + 1} already applied to {title}")
                continue
            else:
                print(f"  [warn] apply cand{ci + 1} -> {title}: {r.status_code} {r.text[:160]}")
                continue
            if status:
                client = rec[0 if owner_of[title] == RECRUITERS[0][0] else 1]
                s = client.post(f"{P}/applications/{app_id}/status", json={"to_status": status, "reason": reason})
                if s.status_code != 200:
                    print(f"  [warn] status {status}: {s.status_code} {s.text[:160]}")
            if consent:
                cands[ci].put(f"{P}/candidate/talent-pool-consent", json={"consent": True})
            print(f"  [ok] cand{ci + 1} -> {title} ({status or 'submitted'})")

    print(f"\nDone. Password for all mock accounts: {PW}")
    print("Recruiters:", ", ".join(e for e, _ in RECRUITERS))
    print("Candidates: cand1@ ... cand8@" + DOMAIN)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true")
    args = ap.parse_args()
    if settings.is_production:
        raise SystemExit("Refusing to create mock data with ENVIRONMENT=production.")
    if args.reset:
        reset()
    seed()