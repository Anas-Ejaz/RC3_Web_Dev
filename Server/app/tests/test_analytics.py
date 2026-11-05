"""Phase 7: analytics numbers, skill-gap wording, scoping and access control.

Embeddings and the LLM are faked at their network boundary only; all application code runs for real.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.models.candidate import Resume

PW = "Str0ng-Passw0rd"
REC, REC2, CAND, CAND2 = "arec@example.com", "arec2@example.com", "acand@example.com", "acand2@example.com"
TEXT = "Skills: Python, Django\nBackend Developer at Acme 2020-2023"
JOB = {
    "title": "Backend Developer", "department": "Eng", "location": "Remote", "type": "full_time", "description": "x",
    "required_skills": [{"name": "Python", "importance": 5}, {"name": "PostgreSQL", "importance": 4}],
    "preferred_skills": [], "min_experience_years": 0, "qualifications": [],
}
_SK = {"evidence_excerpt": "Skills: Python, Django", "verified": True, "edited_by": "ai"}
RESUME = {
    "skills": [{**_SK, "name": "Python", "normalized_name": "Python"}],
    "education": [], "projects": [], "unsupported_claims": [],
    "experience": [{"title": "Backend Developer", "company": "Acme", "start": "2020", "end": "2023", "years": 3.0,
                    "summary": "", "evidence_excerpt": "Backend Developer at Acme 2020-2023"}],
}
_IDX: dict[str, int] = {}


def _fake_embed(texts):
    out = []
    for t in texts:
        i = _IDX.setdefault(t.lower(), len(_IDX))
        vec = [0.0] * 512
        vec[i] = 1.0
        out.append(vec)
    return out


@pytest.fixture(autouse=True)
def fake_ai(monkeypatch):
    monkeypatch.setattr("app.services.embeddings.embed", _fake_embed)
    monkeypatch.setattr(
        "app.services.llm.generate_json",
        lambda **kw: kw["schema"].model_validate({"explanation": "Fake.", "learning_suggestions": []}),
    )


def _register(client, email, role, name):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": PW, "full_name": name, "role": role})
    assert r.status_code == 201
    return r.json()


def _login(client, email):
    assert client.post("/api/v1/auth/login", json={"email": email, "password": PW}).status_code == 200


def _applies(client, db_session, email, name, job_id):
    cand = _register(client, email, "candidate", name)
    db_session.add(Resume(candidate_id=cand["id"], parse_status="parsed", raw_text=TEXT, **RESUME))
    db_session.commit()
    res = client.post(f"/api/v1/jobs/{job_id}/apply")
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _world(client, db_session):
    rec = _register(client, REC, "recruiter", "Rec Boss")
    job = client.post("/api/v1/jobs", json=JOB).json()
    app1 = _applies(client, db_session, CAND, "Cand One", job["id"])
    app2 = _applies(client, db_session, CAND2, "Cand Two", job["id"])
    _login(client, REC)
    return rec, job, app1, app2


def test_overview_funnel_by_job_after_shortlist_and_interview(client, db_session):
    rec, job, app1, app2 = _world(client, db_session)
    assert client.post(f"/api/v1/applications/{app1}/status", json={"to_status": "shortlisted", "reason": "Good"}).status_code == 200
    when = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    res = client.post("/api/v1/interviews", json={
        "application_id": app1, "scheduled_at": when, "duration_minutes": 60, "interviewer_id": rec["id"],
        "type": "technical", "location_or_link": "https://meet.example.com/x"})
    assert res.status_code == 201, res.text

    ov = client.get("/api/v1/analytics/overview").json()
    assert (ov["active_jobs"], ov["total_applications"], ov["shortlisted"]) == (1, 2, 1)
    assert (ov["pending_reviews"], ov["upcoming_interviews"], ov["shortlist_rate"]) == (1, 1, 50.0)
    assert ov["avg_processing_days"] >= 0

    funnel = {f["stage"]: f["count"] for f in client.get("/api/v1/analytics/funnel").json()}
    assert funnel == {"submitted": 2, "ai_assessment_available": 2, "shortlisted": 1, "interview": 1, "selected": 0}

    rows = client.get("/api/v1/analytics/by-job").json()
    assert rows == [{"job_id": job["id"], "title": "Backend Developer", "applications": 2, "shortlisted": 1}]


def test_skill_gaps_use_no_evidence_wording_and_share_of_applicants(client, db_session):
    _, job, _, _ = _world(client, db_session)
    gaps = client.get("/api/v1/analytics/skill-gaps").json()
    assert gaps == [{"skill": "PostgreSQL", "missing_count": 2, "percentage": 100.0}]  # Python has evidence
    assert client.get(f"/api/v1/analytics/skill-gaps?job_id={job['id']}").json() == gaps


def test_empty_state_and_scoping_between_recruiters(client, db_session):
    _, job, _, _ = _world(client, db_session)
    _register(client, REC2, "recruiter", "Rec Two")
    ov = client.get("/api/v1/analytics/overview").json()
    assert ov == {"active_jobs": 0, "total_applications": 0, "shortlisted": 0, "pending_reviews": 0,
                  "upcoming_interviews": 0, "shortlist_rate": 0.0, "avg_processing_days": 0.0}
    assert client.get("/api/v1/analytics/by-job").json() == []
    assert client.get("/api/v1/analytics/skill-gaps").json() == []
    assert all(f["count"] == 0 for f in client.get("/api/v1/analytics/funnel").json())
    assert client.get(f"/api/v1/analytics/funnel?job_id={job['id']}").status_code == 404  # not their job


def test_candidate_blocked_from_analytics(client, db_session):
    _world(client, db_session)
    _login(client, CAND)
    for path in ("overview", "by-job", "funnel", "skill-gaps"):
        assert client.get(f"/api/v1/analytics/{path}").status_code == 403, path