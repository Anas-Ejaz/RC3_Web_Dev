"""Phase 9 audit: scoring, anonymization, role access, upload failures, rate limiting, CORS."""
import pymupdf
import pytest

from app.core.config import settings
from app.main import app
from app.models.job import Job
from app.services import anonymize
from app.services import applications as apps_svc

PW = "Str0ng-Passw0rd"
P = settings.api_prefix
UPLOAD_PATH = "/candidate/resume"  # multipart field "file" (adjust if your route differs)

_IDX: dict[str, int] = {}


def _fake_embed(texts):
    """One-hot fake, same style as the existing tests (no pgvector involved here)."""
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
    r = client.post(f"{P}/auth/register", json={"email": email, "password": PW, "full_name": name, "role": role})
    assert r.status_code == 201, r.text
    return r.json()


def _job(skills):
    return {"title": "Backend Developer", "department": "Eng", "location": "Remote", "type": "full_time",
            "description": "x", "required_skills": [{"name": s, "importance": 5} for s in skills],
            "preferred_skills": [], "min_experience_years": 2, "qualifications": []}


def _resume(skills, line, years):
    head = f"Skills: {', '.join(skills)}"
    sk = {"evidence_excerpt": head, "verified": True, "edited_by": "ai"}
    data = {"skills": [{**sk, "name": s, "normalized_name": s} for s in skills], "education": [], "projects": [],
            "unsupported_claims": [],
            "experience": [{"title": "Developer", "company": "Acme", "start": "2020", "end": "2023", "years": years,
                            "summary": "", "evidence_excerpt": line}]}
    return data, f"{head}\n{line}"


def _routes() -> dict:
    return app.openapi().get("paths", {})


# ---------- scoring ----------
def test_scores_computed_in_code_and_missing_skill_is_no_evidence(client, db_session):
    _register(client, "p9rec@example.com", "recruiter", "P9 Rec")
    job_id = client.post(f"{P}/jobs", json=_job(["Python", "Django", "PostgreSQL", "Docker"])).json()["id"]
    job = db_session.get(Job, job_id)

    strong = _resume(["Python", "Django", "PostgreSQL", "Docker"], "Backend Developer at Acme 2019-2023. Django on PostgreSQL in Docker", 4.0)
    weak = _resume(["React", "TypeScript"], "Frontend Developer at Beta 2021-2023. Built React dashboards", 2.0)
    s = apps_svc.compute_scores(job, strong[0], strong[1])
    w = apps_svc.compute_scores(job, weak[0], weak[1])

    assert s["overall_score"] > w["overall_score"]
    states = {r["skill"]: r["state"] for r in w["skill_results"]}
    assert states["PostgreSQL"] == "no_evidence_found"
    assert "lack" not in " ".join(w["gaps"]).lower()

    bd = s["breakdown"]  # {skills, experience, projects, qualifications}, each {score, weight}
    weights = {k: float(v["weight"]) for k, v in bd.items()}
    assert weights["skills"] > weights["experience"] > weights["projects"] > weights["qualifications"]
    assert abs(weights["skills"] / sum(weights.values()) - 0.5) < 1e-6  # 50 / 25 / 15 / 10
    scale = 100.0 if all(float(v["score"]) <= 1.0 for v in bd.values()) else 1.0
    recomputed = sum(float(v["score"]) * scale * weights[k] for k, v in bd.items()) / sum(weights.values())
    assert abs(recomputed - s["overall_score"]) <= 1.0  # overall = weighted sum of the breakdown


# ---------- anonymization ----------
def test_strip_removes_personal_attributes():
    resume = {"name": "Jane Doe", "email": "jane@x.com", "phone": "+1 555 123 4567", "age": 31, "gender": "F",
              "skills": [], "links": ["https://x.com/jane"]}
    text = "Jane Doe\nAge: 31\nGender: Female\nEmail: jane@x.com\nSkills: Python, Django"
    clean, out = anonymize.strip_for_scoring(resume, text)
    assert "Age" not in out and "Gender" not in out and "jane@x.com" not in out and "Jane" not in out
    assert "Python, Django" in out
    assert clean["name"] is None and clean["email"] is None and "age" not in clean and "gender" not in clean
    assert resume["name"] == "Jane Doe"  # input untouched


# ---------- role-based access ----------
RECRUITER_ONLY = [
    ("GET", "/talent/pool?job_id=1", None),
    ("POST", "/talent/search", {"query": "python"}),
    ("GET", "/talent/duplicates", None),
    ("POST", "/talent/duplicates/1/dismiss", None),
    ("GET", "/analytics/funnel", None),
    ("POST", "/jobs", {}),
]


def test_candidate_and_anonymous_blocked_from_recruiter_routes(client):
    for method, path, body in RECRUITER_ONLY:  # no cookie yet
        r = client.request(method, P + path, json=body)
        assert r.status_code in (401, 403), (method, path, r.status_code)
    _register(client, "p9cand@example.com", "candidate", "P9 Cand")
    for method, path, body in RECRUITER_ONLY:
        r = client.request(method, P + path, json=body)
        assert r.status_code == 403, (method, path, r.status_code)


# ---------- upload validation and parse failures ----------
def _skip_without_upload_route():
    if not any(p.replace("{", "").replace("}", "") == (P + UPLOAD_PATH) and "post" in ops for p, ops in _routes().items()):
        pytest.skip(f"POST {P}{UPLOAD_PATH} not found; set UPLOAD_PATH to your resume upload route")


def _upload(client, name, content, ctype):
    _skip_without_upload_route()
    return client.post(P + UPLOAD_PATH, files={"file": (name, content, ctype)})


def _candidate(client):
    _register(client, "p9up@example.com", "candidate", "P9 Up")


def test_upload_unsupported_type(client):
    _candidate(client)
    r = _upload(client, "virus.exe", b"MZ\x90\x00", "application/octet-stream")
    assert r.status_code == 415 and r.json()["code"] == "UNSUPPORTED_FILE_TYPE"


def test_upload_empty_file(client):
    _candidate(client)
    r = _upload(client, "resume.pdf", b"", "application/pdf")
    assert r.status_code == 422 and r.json()["code"] == "EMPTY_FILE"


def test_upload_too_large(client):
    _candidate(client)
    r = _upload(client, "resume.pdf", b"%PDF-1.4\n" + b"0" * (settings.max_upload_bytes + 10), "application/pdf")
    assert r.status_code == 413 and r.json()["code"] == "FILE_TOO_LARGE"


def test_upload_corrupted_pdf_reports_parse_failure(client):
    _candidate(client)
    r = _upload(client, "resume.pdf", b"%PDF-1.4\nthis is not really a pdf", "application/pdf")
    assert r.status_code == 200 and r.json()["parse_status"] in ("failed", "empty")


def test_upload_scanned_pdf_without_text_layer(client):
    _candidate(client)
    doc = pymupdf.open()
    page = doc.new_page()
    page.draw_rect(pymupdf.Rect(50, 50, 300, 300), fill=(0, 0, 0))  # image-like content, no text
    data = doc.tobytes()
    doc.close()
    r = _upload(client, "scan.pdf", data, "application/pdf")
    assert r.status_code == 200 and r.json()["parse_status"] in ("failed", "empty")


# ---------- login rate limiting ----------
def test_login_rate_limit_blocks_repeated_failures(client):
    _register(client, "p9rl@example.com", "candidate", "P9 RL")
    codes = [client.post(f"{P}/auth/login", json={"email": "p9rl@example.com", "password": "Wrong-Passw0rd"}).status_code
             for _ in range(settings.login_max_attempts + 2)]
    assert codes[0] in (400, 401)
    assert 429 in codes, codes  # if this fails, login throttling is missing from the auth router


# ---------- CORS ----------
def test_cors_allows_only_frontend_origin(client):
    ok = client.options(f"{P}/health", headers={"Origin": settings.frontend_url, "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == settings.frontend_url
    assert ok.headers.get("access-control-allow-credentials") == "true"
    evil = {"Origin": "https://evil.example"}
    pre = client.options(f"{P}/health", headers={**evil, "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in pre.headers
    assert "access-control-allow-origin" not in client.get(f"{P}/health", headers=evil).headers