"""Job CRUD, visibility, ownership and extraction wiring."""
from app.core.config import settings

PW = "Str0ng-Passw0rd"
JOB = {
    "title": "Backend Developer", "department": "Engineering", "location": "Remote", "type": "full_time",
    "description": "We need Python, Django, PostgreSQL and Docker.",
    "required_skills": [{"name": "py", "importance": 5}, {"name": "Postgres", "importance": 4}],
    "preferred_skills": [], "min_experience_years": 2, "qualifications": ["BSc in CS"],
}


def _register(client, email, role):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": PW, "full_name": "T U", "role": role})
    assert r.status_code == 201
    return r


def test_candidate_cannot_create_job(client):
    _register(client, "jc1@example.com", "candidate")
    assert client.post("/api/v1/jobs", json=JOB).status_code == 403


def test_create_job_normalizes_skills(client):
    _register(client, "jr1@example.com", "recruiter")
    res = client.post("/api/v1/jobs", json=JOB)
    assert res.status_code == 201
    names = [s["name"] for s in res.json()["required_skills"]]
    assert names == ["Python", "PostgreSQL"]
    assert res.json()["status"] == "open"


def test_salary_validation(client):
    _register(client, "jr2@example.com", "recruiter")
    res = client.post("/api/v1/jobs", json={**JOB, "salary_min": 100, "salary_max": 50})
    assert res.status_code == 422


def test_candidates_see_only_open_jobs(client):
    _register(client, "jr3@example.com", "recruiter")
    open_id = client.post("/api/v1/jobs", json=JOB).json()["id"]
    closed_id = client.post("/api/v1/jobs", json=JOB).json()["id"]
    assert client.post(f"/api/v1/jobs/{closed_id}/close").json()["status"] == "closed"

    _register(client, "jc3@example.com", "candidate")
    ids = [j["id"] for j in client.get("/api/v1/jobs?page_size=100").json()["items"]]
    assert open_id in ids and closed_id not in ids
    assert client.get(f"/api/v1/jobs/{closed_id}").status_code == 404


def test_other_recruiter_cannot_access_or_modify_job(client):
    _register(client, "jra@example.com", "recruiter")
    job_id = client.post("/api/v1/jobs", json=JOB).json()["id"]
    _register(client, "jrb@example.com", "recruiter")
    assert client.get(f"/api/v1/jobs/{job_id}").status_code == 404
    assert client.put(f"/api/v1/jobs/{job_id}", json=JOB).status_code == 404
    assert client.post(f"/api/v1/jobs/{job_id}/close").status_code == 404


def test_extract_requires_recruiter(client):
    _register(client, "jc4@example.com", "candidate")
    res = client.post("/api/v1/jobs/extract-requirements", json={"description": "x" * 40})
    assert res.status_code == 403


def test_extract_without_api_key_is_a_clean_error(client, monkeypatch):
    monkeypatch.setattr(settings, "groq_api_key", "")
    _register(client, "jr5@example.com", "recruiter")
    res = client.post("/api/v1/jobs/extract-requirements", json={"description": "Need Python and Django skills."})
    assert res.status_code == 503 and res.json()["code"] == "LLM_NOT_CONFIGURED"


def test_extract_pipeline_normalizes_and_clamps(client, monkeypatch):
    def fake_llm(**kw):  # replaces only the network boundary
        return kw["schema"].model_validate({
            "required_skills": [{"name": "js", "importance": 9}, {"name": "k8s", "importance": 4}, {"name": "JavaScript", "importance": 2}],
            "preferred_skills": [{"name": "Postgres"}],
            "min_experience_years": 3, "qualifications": ["BSc"],
        })

    monkeypatch.setattr("app.services.llm.generate_json", fake_llm)
    _register(client, "jr6@example.com", "recruiter")
    body = client.post("/api/v1/jobs/extract-requirements", json={"description": "Need JS and k8s experience for backend."}).json()
    assert body["required_skills"] == [{"name": "JavaScript", "importance": 5}, {"name": "Kubernetes", "importance": 4}]
    assert body["preferred_skills"] == [{"name": "PostgreSQL", "importance": 3}]
    assert body["min_experience_years"] == 3