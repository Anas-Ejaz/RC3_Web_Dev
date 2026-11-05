"""Phase 8a: candidate recommendations, talent-pool consent, permissions and retention."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from app.models.application import Application
from app.models.candidate import Resume

PW = "Str0ng-Passw0rd"
REC, REC2 = "trec@example.com", "trec2@example.com"
C1, C2, C3 = "tc1@example.com", "tc2@example.com", "tc3@example.com"
TEXT = "Skills: Python, Django\nBackend Developer at Acme 2020-2023\nBuilt APIs with Django"
_SK = {"evidence_excerpt": "Skills: Python, Django", "verified": True, "edited_by": "ai"}
RESUME = {
    "skills": [{**_SK, "name": "Python", "normalized_name": "Python"}, {**_SK, "name": "Django", "normalized_name": "Django"}],
    "education": [], "projects": [], "unsupported_claims": [],
    "experience": [{"title": "Backend Developer", "company": "Acme", "start": "2020", "end": "2023", "years": 3.0,
                    "summary": "", "evidence_excerpt": "Backend Developer at Acme 2020-2023"}],
}
_IDX: dict[str, int] = {}


def _fake_embed(texts):
    out = []
    for t in texts:
        i = _IDX.setdefault(t.lower(), len(_IDX))
        vec = [0.0] * 1024
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


def _job(title, skills):
    return {"title": title, "department": "Eng", "location": "Remote", "type": "full_time", "description": "x",
            "required_skills": [{"name": s, "importance": 5} for s in skills], "preferred_skills": [],
            "min_experience_years": 2, "qualifications": []}


def _register(client, email, role, name):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": PW, "full_name": name, "role": role})
    assert r.status_code == 201
    return r.json()


def _login(client, email):
    assert client.post("/api/v1/auth/login", json={"email": email, "password": PW}).status_code == 200


def _save_resume(db_session, user_id):
    db_session.add(Resume(candidate_id=user_id, parse_status="parsed", raw_text=TEXT, **RESUME))
    db_session.commit()


def test_recommendations_ranked_filtered_and_exclude_applied(client, db_session):
    _register(client, REC, "recruiter", "Rec Boss")
    a = client.post("/api/v1/jobs", json=_job("Backend Developer", ["Python", "Django"])).json()["id"]
    b = client.post("/api/v1/jobs", json=_job("Frontend Developer", ["React"])).json()["id"]
    c = client.post("/api/v1/jobs", json=_job("Data Engineer", ["Python", "PostgreSQL"])).json()["id"]
    cand = _register(client, C1, "candidate", "Cand One")
    assert client.get("/api/v1/candidate/recommendations").json() == []  # no resume yet

    _save_resume(db_session, cand["id"])
    recs = client.get("/api/v1/candidate/recommendations").json()
    mine = [r for r in recs if r["job"]["id"] in (a, b, c)]
    assert [r["job"]["id"] for r in mine] == [a, c]  # React job has no evidence -> skipped; best fit first
    assert mine[0]["matched_skills"] == ["Python", "Django"] and mine[0]["match_score"] > mine[1]["match_score"]
    assert "2 of 2 required skills" in mine[0]["reason"]
    assert "No evidence was found yet for PostgreSQL" in mine[1]["reason"] and "lack" not in mine[1]["reason"].lower()

    assert client.post(f"/api/v1/jobs/{a}/apply").status_code == 201
    after = [r["job"]["id"] for r in client.get("/api/v1/candidate/recommendations").json()]
    assert a not in after and c in after

    _login(client, REC)
    assert client.get("/api/v1/candidate/recommendations").status_code == 403


def test_pool_respects_consent_review_status_retention_and_ownership(client, db_session):
    _register(client, REC, "recruiter", "Rec Boss")
    old = client.post("/api/v1/jobs", json=_job("Backend Developer", ["Python", "Django"])).json()["id"]
    new = client.post("/api/v1/jobs", json=_job("Platform Engineer", ["Python", "Django", "Docker"])).json()["id"]

    ids, apps = {}, {}
    for key, email in (("c1", C1), ("c2", C2), ("c3", C3)):
        u = _register(client, email, "candidate", key.upper())
        _save_resume(db_session, u["id"])
        res = client.post(f"/api/v1/jobs/{old}/apply")
        assert res.status_code == 201, res.text
        ids[key], apps[key] = u["id"], res.json()["id"]

    _login(client, REC)
    assert client.post(f"/api/v1/applications/{apps['c1']}/status", json={"to_status": "shortlisted", "reason": "ok"}).status_code == 200
    assert client.post(f"/api/v1/applications/{apps['c2']}/status", json={"to_status": "rejected", "reason": "Different role"}).status_code == 200
    # c3 is never reviewed

    assert client.get("/api/v1/talent/pool", params={"job_id": new}).json() == []  # nobody has consented yet

    _login(client, C1)
    assert client.get("/api/v1/candidate/talent-pool-consent").json()["consent"] is False
    assert client.put("/api/v1/candidate/talent-pool-consent", json={"consent": True}).json()["consent"] is True
    _login(client, C3)
    client.put("/api/v1/candidate/talent-pool-consent", json={"consent": True})  # consents but was never reviewed
    # c2 (rejected) never consents

    _login(client, REC)
    pool = client.get("/api/v1/talent/pool", params={"job_id": new}).json()
    assert [p["candidate_id"] for p in pool] == [ids["c1"]]
    p = pool[0]
    assert p["consent_given"] is True and p["previous_status"] == "shortlisted" and p["source_job_title"] == "Backend Developer"
    assert 179 <= p["retention_days_left"] <= 180 and "Python" in p["matched_skills"]
    assert any("Docker" in g for g in p["gaps"]) and all("lack" not in g.lower() for g in p["gaps"])

    _login(client, C1)  # revoking removes the candidate immediately
    client.put("/api/v1/candidate/talent-pool-consent", json={"consent": False})
    _login(client, REC)
    assert client.get("/api/v1/talent/pool", params={"job_id": new}).json() == []

    _login(client, C1)
    client.put("/api/v1/candidate/talent-pool-consent", json={"consent": True})
    db_session.execute(update(Application).where(Application.id == apps["c1"])
                       .values(updated_at=datetime.now(timezone.utc) - timedelta(days=400)))
    db_session.commit()
    _login(client, REC)
    assert client.get("/api/v1/talent/pool", params={"job_id": new}).json() == []  # past retention

    _register(client, REC2, "recruiter", "Rec Two")
    assert client.get("/api/v1/talent/pool", params={"job_id": new}).status_code == 404  # not their job
    own = client.post("/api/v1/jobs", json=_job("Other", ["Python"])).json()["id"]
    assert client.get("/api/v1/talent/pool", params={"job_id": own}).json() == []  # cannot see another recruiter's applicants


def test_candidate_blocked_from_pool(client, db_session):
    _register(client, REC, "recruiter", "Rec Boss")
    job = client.post("/api/v1/jobs", json=_job("Backend Developer", ["Python"])).json()["id"]
    _register(client, C1, "candidate", "Cand One")
    assert client.get("/api/v1/talent/pool", params={"job_id": job}).status_code == 403