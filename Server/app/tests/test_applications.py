"""Phases 4+5: scoring logic, evidence states, apply flow, audit trail, access control.

Embeddings and the LLM are faked at their network boundary only; all scoring code runs for real.
"""
import pytest

from app.models.candidate import Resume
from app.services import matching

PW = "Str0ng-Passw0rd"
REC, CAND = "rec@example.com", "cand@example.com"
TEXT = "Skills: Python, Django\nBackend Developer at Acme 2020-2023\nBuilt APIs with Django"
JOB = {
    "title": "Backend Developer", "department": "Eng", "location": "Remote", "type": "full_time",
    "description": "Python Django PostgreSQL Docker",
    "required_skills": [
        {"name": "Python", "importance": 5}, {"name": "Django", "importance": 5},
        {"name": "PostgreSQL", "importance": 4}, {"name": "Docker", "importance": 3},
    ],
    "preferred_skills": [], "min_experience_years": 2, "qualifications": [],
}
_IDX: dict[str, int] = {}


def _fake_embed(texts):
    out = []
    for t in texts:
        i = _IDX.setdefault(t.lower(), len(_IDX))
        vec = [0.0] * 512
        vec[i] = 1.0  # identical text -> similarity 1, different text -> 0
        out.append(vec)
    return out


@pytest.fixture(autouse=True)
def fake_ai(monkeypatch):
    monkeypatch.setattr("app.services.embeddings.embed", _fake_embed)
    monkeypatch.setattr(
        "app.services.llm.generate_json",
        lambda **kw: kw["schema"].model_validate({"explanation": "Fake explanation.", "learning_suggestions": ["Practice PostgreSQL"]}),
    )


def _skill(name, ex="Skills: Python, Django"):
    return {"name": name, "normalized_name": name, "evidence_excerpt": ex, "verified": True, "edited_by": "ai"}


RESUME = {
    "skills": [_skill("Python"), _skill("Django")], "education": [], "projects": [], "unsupported_claims": [],
    "experience": [{"title": "Backend Developer", "company": "Acme", "start": "2020", "end": "2023", "years": 3.0,
                    "summary": "", "evidence_excerpt": "Backend Developer at Acme 2020-2023"}],
}


def _register(client, email, role, name="Rec Boss"):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": PW, "full_name": name, "role": role})
    assert r.status_code == 201
    return r.json()


def _login(client, email):
    assert client.post("/api/v1/auth/login", json={"email": email, "password": PW}).status_code == 200


def _setup(client, db_session):
    _register(client, REC, "recruiter")
    job = client.post("/api/v1/jobs", json=JOB).json()
    cand = _register(client, CAND, "candidate", "Cand One")
    db_session.add(Resume(candidate_id=cand["id"], parse_status="parsed", raw_text=TEXT, **RESUME))
    db_session.commit()
    return job, cand


def _apply(client, job_id):
    res = client.post(f"/api/v1/jobs/{job_id}/apply")
    assert res.status_code == 201, res.text
    return res.json()


# ---------- pure scoring logic ----------
def test_weighted_score_and_evidence_states():
    out = matching.compute(
        {"title": "Backend", "required_skills": JOB["required_skills"], "preferred_skills": [],
         "min_experience_years": 2, "qualifications": []},
        RESUME, TEXT,
    )
    states = {r["skill"]: r["state"] for r in out["skill_results"]}
    assert states == {"Python": "confirmed", "Django": "confirmed", "PostgreSQL": "no_evidence_found", "Docker": "no_evidence_found"}
    b = out["breakdown"]
    assert b["skills"]["score"] == pytest.approx(58.8, abs=0.1)  # (5+5)/(5+5+4+3)
    assert b["experience"]["score"] == 100 and b["projects"]["score"] == 0 and b["qualifications"]["score"] == 100
    assert [b[k]["weight"] for k in ("skills", "experience", "projects", "qualifications")] == [0.5, 0.25, 0.15, 0.10]
    assert out["overall_score"] == pytest.approx(0.5 * 58.82 + 25 + 0 + 10, abs=0.2)
    assert all("lacks" not in g.lower() for g in out["gaps"])
    assert any("No evidence found for required skill: PostgreSQL" in g for g in out["gaps"])


def test_project_technology_without_mention_is_weak_evidence():
    resume = {**RESUME, "projects": [{"name": "Shop", "description": "API service", "technologies": ["Docker"],
                                      "evidence_excerpt": "Built an API service"}]}
    out = matching.compute({"title": "B", "required_skills": [{"name": "Docker", "importance": 3}], "preferred_skills": [],
                            "min_experience_years": 0, "qualifications": []}, resume, TEXT + "\nBuilt an API service")
    assert out["skill_results"][0]["state"] == "weak_evidence"


def test_unverified_skill_does_not_count():
    resume = {**RESUME, "skills": [{**_skill("Docker"), "verified": False, "evidence_excerpt": ""}]}
    out = matching.compute({"title": "B", "required_skills": [{"name": "Docker", "importance": 3}], "preferred_skills": [],
                            "min_experience_years": 0, "qualifications": []}, resume, TEXT)
    assert out["skill_results"][0]["state"] == "no_evidence_found"


# ---------- apply flow + audit ----------
def test_apply_scores_explains_and_logs(client, db_session):
    job, _ = _setup(client, db_session)
    body = _apply(client, job["id"])
    assert body["status"] == "ai_assessment_available" and body["assessment"] is None  # hidden from candidates
    assert client.get("/api/v1/candidate/applications").json()[0]["assessment"] is None

    _login(client, REC)
    d = client.get(f"/api/v1/applications/{body['id']}").json()
    a = d["assessment"]
    assert a["overall_score"] == pytest.approx(64.4, abs=0.2)
    assert a["explanation"] == "Fake explanation."
    assert [x["to_status"] for x in d["audit"]] == ["submitted", "parsed", "ai_assessment_available"]
    assert client.get(f"/api/v1/jobs/{job['id']}").json()["applicant_count"] == 1


def test_duplicate_apply_and_resume_required(client, db_session):
    job, _ = _setup(client, db_session)
    _apply(client, job["id"])
    assert client.post(f"/api/v1/jobs/{job['id']}/apply").json()["code"] == "ALREADY_APPLIED"
    _register(client, "other@example.com", "candidate", "Other")
    assert client.post(f"/api/v1/jobs/{job['id']}/apply").json()["code"] == "RESUME_REQUIRED"


def test_manual_status_change_writes_audit_and_validates(client, db_session):
    job, _ = _setup(client, db_session)
    app_id = _apply(client, job["id"])["id"]
    _login(client, REC)
    bad = client.post(f"/api/v1/applications/{app_id}/status", json={"to_status": "selected"})
    assert bad.status_code == 409 and bad.json()["code"] == "INVALID_TRANSITION"
    ok = client.post(f"/api/v1/applications/{app_id}/status", json={"to_status": "shortlisted", "reason": "Strong Python evidence"})
    assert ok.status_code == 200 and ok.json()["status"] == "shortlisted"
    last = client.get(f"/api/v1/applications/{app_id}/audit").json()[-1]
    assert (last["from_status"], last["to_status"], last["reason"]) == ("ai_assessment_available", "shortlisted", "Strong Python evidence")
    assert last["changed_by"] == "Rec Boss" and last["created_at"]
    assert client.post(f"/api/v1/applications/{app_id}/status", json={"to_status": "rejected"}).json()["code"] == "REASON_REQUIRED"


def test_override_keeps_computed_score_and_is_audited(client, db_session):
    job, _ = _setup(client, db_session)
    app_id = _apply(client, job["id"])["id"]
    _login(client, REC)
    res = client.put(f"/api/v1/applications/{app_id}/override", json={"score": 90, "reason": "Verified portfolio"})
    a = res.json()
    assert res.status_code == 200 and a["overridden"] and a["override_score"] == 90
    assert a["overall_score"] == pytest.approx(64.4, abs=0.2)  # computed score is never overwritten
    assert client.get(f"/api/v1/applications/{app_id}/audit").json()[-1]["reason"].startswith("Score override")
    hits = client.get(f"/api/v1/jobs/{job['id']}/applications?min_score=80").json()
    assert hits["total"] == 1


def test_recruiter_skill_correction_rescores(client, db_session):
    job, _ = _setup(client, db_session)
    app_id = _apply(client, job["id"])["id"]
    _login(client, REC)
    before = client.get(f"/api/v1/applications/{app_id}").json()["assessment"]["overall_score"]
    skills = [{"name": "Python", "evidence_excerpt": "Skills: Python, Django"}, {"name": "Django", "evidence_excerpt": "Skills: Python, Django"},
              {"name": "Docker", "evidence_excerpt": "Invented line that is not in the resume"}]
    res = client.put(f"/api/v1/applications/{app_id}/skills", json={"skills": skills})
    assert res.status_code == 200
    states = {r["skill"]: r["state"] for r in res.json()["skill_results"]}
    assert states["Docker"] == "no_evidence_found"  # fabricated excerpt is not accepted as evidence
    assert res.json()["overall_score"] == pytest.approx(before, abs=0.01)
    claims = client.get(f"/api/v1/applications/{app_id}").json()["resume"]["unsupported_claims"]
    assert any("Docker" in c["claim"] for c in claims)


# ---------- access control ----------
def test_candidate_blocked_from_recruiter_routes(client, db_session):
    job, _ = _setup(client, db_session)
    app_id = _apply(client, job["id"])["id"]  # logged in as the candidate
    for method, path, body in [
        ("get", f"/api/v1/applications/{app_id}", None),
        ("get", f"/api/v1/applications/{app_id}/notes", None),
        ("post", f"/api/v1/applications/{app_id}/notes", {"text": "x"}),
        ("get", f"/api/v1/applications/{app_id}/audit", None),
        ("post", f"/api/v1/applications/{app_id}/status", {"to_status": "shortlisted"}),
        ("post", f"/api/v1/applications/{app_id}/reassess", None),
        ("get", f"/api/v1/jobs/{job['id']}/applications", None),
        ("post", "/api/v1/applications/compare", {"application_ids": [app_id, app_id + 1]}),
    ]:
        res = getattr(client, method)(path, **({"json": body} if body is not None else {}))
        assert res.status_code == 403, (method, path, res.status_code)


def test_other_recruiter_cannot_reach_application_and_notes_are_private(client, db_session):
    job, _ = _setup(client, db_session)
    app_id = _apply(client, job["id"])["id"]
    _login(client, REC)
    assert client.post(f"/api/v1/applications/{app_id}/notes", json={"text": "Call back Monday"}).status_code == 201
    assert len(client.get(f"/api/v1/applications/{app_id}/notes").json()) == 1

    _register(client, "rec2@example.com", "recruiter", "Rec Two")
    assert client.get(f"/api/v1/applications/{app_id}").status_code == 404
    assert client.get(f"/api/v1/applications/{app_id}/notes").status_code == 404
    assert client.post(f"/api/v1/applications/{app_id}/status", json={"to_status": "shortlisted"}).status_code == 404
    assert client.get(f"/api/v1/jobs/{job['id']}/applications").status_code == 404