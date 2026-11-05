"""Phase 8a: attribute stripping and the fairness test (real scoring path; only embeddings/LLM are faked)."""
import pytest

from app.models.candidate import Resume
from app.services.anonymize import strip_for_scoring

PW = "Str0ng-Passw0rd"
REC, REC2, CAND = "frec@example.com", "frec2@example.com", "fcand@example.com"
TEXT = "Cand One\nSkills: Python, Django\nBackend Developer at Acme 2020-2023\nBuilt APIs with Django"
JOB = {
    "title": "Backend Developer", "department": "Eng", "location": "Remote", "type": "full_time",
    "description": "Python Django PostgreSQL Docker",
    "required_skills": [
        {"name": "Python", "importance": 5}, {"name": "Django", "importance": 5},
        {"name": "PostgreSQL", "importance": 4}, {"name": "Docker", "importance": 3},
    ],
    "preferred_skills": [], "min_experience_years": 2, "qualifications": [],
}


def _sk(name):
    return {"name": name, "normalized_name": name, "evidence_excerpt": "Skills: Python, Django", "verified": True, "edited_by": "ai"}


RESUME = {
    "skills": [_sk("Python"), _sk("Django")], "education": [], "projects": [], "unsupported_claims": [],
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


def _register(client, email, role, name):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": PW, "full_name": name, "role": role})
    assert r.status_code == 201
    return r.json()


def _login(client, email):
    assert client.post("/api/v1/auth/login", json={"email": email, "password": PW}).status_code == 200


def _world(client, db_session):
    _register(client, REC, "recruiter", "Rec Boss")
    job = client.post("/api/v1/jobs", json=JOB).json()
    cand = _register(client, CAND, "candidate", "Cand One")
    db_session.add(Resume(candidate_id=cand["id"], parse_status="parsed", raw_text=TEXT, name="Cand One", **RESUME))
    db_session.commit()
    res = client.post(f"/api/v1/jobs/{job['id']}/apply")
    assert res.status_code == 201, res.text
    _login(client, REC)
    return res.json()["id"]


def test_strip_removes_personal_attributes_but_keeps_evidence():
    resume = {"name": "Priya Sharma", "email": "priya@x.com", "phone": "+92 300 1234567", "links": ["l"],
              "gender": "female", "skills": []}
    text = ("Priya Sharma\nGender: Female\nAge: 29\nAddress: 12 Street, Lahore\n"
            "Contact: priya@x.com / +92 300 1234567\nSkills: Python, Django")
    clean, out = strip_for_scoring(resume, text)
    low = out.lower()
    assert "priya" not in low and "female" not in low and "lahore" not in low and "@" not in out and "29" not in out
    assert "Skills: Python, Django" in out
    assert clean["name"] is None and clean["links"] == [] and "gender" not in clean
    assert resume["name"] == "Priya Sharma"  # input not modified


def test_fairness_endpoint_reports_zero_delta(client, db_session):
    app_id = _world(client, db_session)
    res = client.post("/api/v1/fairness/test",
                      json={"application_id": app_id, "attributes": ["name", "gender", "age", "location"]})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["passed"] is True and body["max_abs_delta"] == 0
    assert len(body["variants"]) == 9  # 2 names + 3 genders + 2 ages + 2 locations
    assert {v["attribute"] for v in body["variants"]} == {"name", "gender", "age", "location"}
    assert all(v["delta"] == 0 for v in body["variants"])
    assert body["original_score"] == pytest.approx(64.4, abs=0.2)


def test_fairness_harness_detects_a_biased_scorer(client, db_session, monkeypatch):
    """Proves the test can FAIL: strip is disabled and the scorer is made to penalise one gender."""
    from app.services import matching

    app_id = _world(client, db_session)
    real = matching.compute

    def biased(job, resume, text):
        out = real(job, resume, text)
        if "gender: female" in text.lower():
            out = {**out, "overall_score": round(out["overall_score"] - 8, 1)}
        return out

    monkeypatch.setattr("app.services.applications.strip_for_scoring", lambda r, t: (r, t))
    monkeypatch.setattr("app.services.matching.compute", biased)
    body = client.post("/api/v1/fairness/test", json={"application_id": app_id, "attributes": ["gender"]}).json()
    assert body["passed"] is False
    assert any(v["delta"] == pytest.approx(-8.0, abs=0.01) for v in body["variants"])


def test_fairness_access_control(client, db_session):
    app_id = _world(client, db_session)
    _register(client, REC2, "recruiter", "Rec Two")
    assert client.post("/api/v1/fairness/test", json={"application_id": app_id}).status_code == 404  # not their job
    _login(client, CAND)
    assert client.post("/api/v1/fairness/test", json={"application_id": app_id}).status_code == 403