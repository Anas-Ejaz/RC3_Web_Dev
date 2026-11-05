"""Phase 8b: semantic talent search and duplicate detection (384-dim fake embeddings, LLM faked)."""
import re
import zlib
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update

from app.core.errors import AppError
from app.models.application import Application, AuditLog
from app.models.candidate import Resume
from app.models.talent import DuplicateCandidate, ResumeChunk
from app.models.user import User
from app.services.search import QueryParse

PW = "Str0ng-Passw0rd"
REC, REC2 = "srec@example.com", "srec2@example.com"
DIM = 384


def _fake_embed(texts):
    """Deterministic bag-of-words hashing into 384 dims: similar texts get similar vectors."""
    out = []
    for t in texts:
        vec = [0.0] * DIM
        for tok in re.findall(r"[a-z0-9+#.]+", t.lower()):
            vec[zlib.crc32(tok.encode()) % DIM] += 1.0
        if not any(vec):
            vec[0] = 1.0
        out.append(vec)
    return out


def _fake_generate_json(**kw):
    schema = kw["schema"]
    if schema is QueryParse:
        q = kw["user"].lower()
        skills = [s for s in ("Python", "Django", "PostgreSQL", "React", "Docker") if s.lower() in q]
        m = re.search(r"at least (\d+)", q)
        return QueryParse(
            skills=skills,
            min_experience_years=float(m.group(1)) if m else None,
            strict_min_experience=bool(m),
            keywords=["developer"] if "developer" in q else [],
        )
    return schema.model_validate({"explanation": "Fake.", "learning_suggestions": []})


@pytest.fixture(autouse=True)
def fake_ai(monkeypatch):
    monkeypatch.setattr("app.services.embeddings.embed", _fake_embed)
    monkeypatch.setattr("app.services.llm.generate_json", _fake_generate_json)


# ---------- helpers ----------
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


def _resume(skills, line, years=3.0):
    head = f"Skills: {', '.join(skills)}"
    sk = {"evidence_excerpt": head, "verified": True, "edited_by": "ai"}
    data = {
        "skills": [{**sk, "name": s, "normalized_name": s} for s in skills],
        "education": [], "projects": [], "unsupported_claims": [],
        "experience": [{"title": "Developer", "company": "Acme", "start": "2020", "end": "2023", "years": years,
                        "summary": "", "evidence_excerpt": line}],
    }
    return f"{head}\n{line}", data


def _candidate(client, db_session, email, name, skills, line, job_id=None, resume_email=None, resume_phone=None):
    """Register a candidate (logs in as them), store a resume and optionally apply. Returns (user_id, app_id)."""
    user = _register(client, email, "candidate", name)
    text, data = _resume(skills, line)
    db_session.add(Resume(candidate_id=user["id"], parse_status="parsed", raw_text=text,
                          email=resume_email, phone=resume_phone, **data))
    db_session.commit()
    app_id = None
    if job_id is not None:
        res = client.post(f"/api/v1/jobs/{job_id}/apply")
        assert res.status_code == 201, res.text
        app_id = res.json()["id"]
    return user["id"], app_id


def _search(client, query, job_id=None, limit=10):
    body = {"query": query, "limit": limit}
    if job_id is not None:
        body["job_id"] = job_id
    return client.post("/api/v1/talent/search", json=body)


PY_LINE = "Backend Developer at Acme 2020-2023. Built APIs with Django and PostgreSQL"


# ---------- search ----------
def test_search_ranks_by_computed_score_and_drops_fabricated_evidence(client, db_session):
    _register(client, REC, "recruiter", "Rec Boss")
    job = client.post("/api/v1/jobs", json=_job("Backend Developer", ["Python", "Django"])).json()["id"]
    c1, app1 = _candidate(client, db_session, "s1@example.com", "S One", ["Python", "Django", "PostgreSQL"], PY_LINE, job)
    c2, _ = _candidate(client, db_session, "s2@example.com", "S Two", ["React", "TypeScript"],
                       "Frontend Developer at Beta 2021-2023. Built dashboards with React", job)

    _login(client, REC)
    r = _search(client, "Python Django developer", job)
    assert r.status_code == 200, r.text
    assert r.headers["X-Search-Mode"] == "llm+embeddings"
    hits = r.json()
    assert [h["candidate_id"] for h in hits][0] == c1
    assert hits[0]["score"] > hits[1]["score"] and 0 <= hits[1]["score"] <= hits[0]["score"] <= 100
    assert {"Python", "Django"} <= set(hits[0]["matched_terms"])
    assert hits[0]["evidence_excerpts"] and "Django" in " ".join(hits[0]["evidence_excerpts"])
    assert "lack" not in str(hits).lower()
    first_score = hits[0]["score"]

    # A fabricated chunk (not in the resume) that matches the query perfectly must be dropped and not boost the score.
    existing = db_session.scalars(select(ResumeChunk).where(ResumeChunk.application_id == app1)).all()
    assert existing
    db_session.add(ResumeChunk(
        application_id=app1, chunk_index=99, chunk_text="Led a team of 50 engineers at Google",
        text_hash=existing[0].text_hash, embedding=_fake_embed(["Python Django developer"])[0]))
    db_session.commit()
    hits2 = _search(client, "Python Django developer", job).json()
    assert hits2[0]["candidate_id"] == c1
    assert "Google" not in " ".join(hits2[0]["evidence_excerpts"])
    assert hits2[0]["evidence_excerpts"]
    assert hits2[0]["score"] == first_score


def test_chunks_are_reindexed_when_resume_text_changes(client, db_session):
    _register(client, REC, "recruiter", "Rec Boss")
    job = client.post("/api/v1/jobs", json=_job("Backend Developer", ["Python"])).json()["id"]
    _, app1 = _candidate(client, db_session, "s1@example.com", "S One", ["Python"], PY_LINE, job)
    _login(client, REC)
    assert _search(client, "Python developer", job).status_code == 200
    before = db_session.scalars(select(ResumeChunk.text_hash).where(ResumeChunk.application_id == app1)).first()
    assert before

    db_session.execute(update(Application).where(Application.id == app1)
                       .values(resume_text="Skills: Python, Docker\nShipped Docker images for Acme services"))
    db_session.commit()
    assert _search(client, "Python developer", job).status_code == 200
    after = db_session.scalars(select(ResumeChunk.text_hash).where(ResumeChunk.application_id == app1)).all()
    assert after and after[0] != before and len(set(after)) == 1


def test_search_pool_rules_consent_retention_ownership(client, db_session):
    _register(client, REC, "recruiter", "Rec Boss")
    old = client.post("/api/v1/jobs", json=_job("Backend Developer", ["Python", "Django"])).json()["id"]
    new = client.post("/api/v1/jobs", json=_job("Platform Engineer", ["Python", "Django"])).json()["id"]
    ids, apps = {}, {}
    for key in ("c1", "c2", "c3"):
        ids[key], apps[key] = _candidate(client, db_session, f"s{key}@example.com", key.upper(),
                                         ["Python", "Django"], PY_LINE, old)

    _login(client, REC)
    assert client.post(f"/api/v1/applications/{apps['c1']}/status", json={"to_status": "shortlisted", "reason": "ok"}).status_code == 200
    assert client.post(f"/api/v1/applications/{apps['c2']}/status", json={"to_status": "rejected", "reason": "Other role"}).status_code == 200
    # c3 is never reviewed
    assert _search(client, "Python Django developer").json() == []  # nobody consented yet

    _login(client, "sc1@example.com")
    client.put("/api/v1/candidate/talent-pool-consent", json={"consent": True})
    _login(client, "sc3@example.com")
    client.put("/api/v1/candidate/talent-pool-consent", json={"consent": True})  # consents but never reviewed

    _login(client, REC)
    assert [h["candidate_id"] for h in _search(client, "Python Django developer").json()] == [ids["c1"]]
    assert [h["candidate_id"] for h in _search(client, "Python Django developer", new).json()] == [ids["c1"]]

    # c2 (no consent) applies to the new job: the job's own applicants are always searchable by the recruiter.
    _login(client, "sc2@example.com")
    assert client.post(f"/api/v1/jobs/{new}/apply").status_code == 201
    _login(client, REC)
    got = {h["candidate_id"] for h in _search(client, "Python Django developer", new).json()}
    assert got == {ids["c1"], ids["c2"]}

    _login(client, "sc1@example.com")  # revoking removes the candidate from search at once
    client.put("/api/v1/candidate/talent-pool-consent", json={"consent": False})
    _login(client, REC)
    assert {h["candidate_id"] for h in _search(client, "Python Django developer", new).json()} == {ids["c2"]}
    assert _search(client, "Python Django developer").json() == []

    _login(client, "sc1@example.com")
    client.put("/api/v1/candidate/talent-pool-consent", json={"consent": True})
    db_session.execute(update(Application).where(Application.id == apps["c1"])
                       .values(updated_at=datetime.now(timezone.utc) - timedelta(days=400)))
    db_session.commit()
    _login(client, REC)
    assert _search(client, "Python Django developer").json() == []  # past retention

    _register(client, REC2, "recruiter", "Rec Two")
    assert _search(client, "Python Django developer", new).status_code == 404  # not their job
    assert _search(client, "Python Django developer").json() == []  # cannot see another recruiter's applicants


def test_search_falls_back_to_embeddings_only_when_llm_is_down(client, db_session, monkeypatch):
    _register(client, REC, "recruiter", "Rec Boss")
    job = client.post("/api/v1/jobs", json=_job("Backend Developer", ["Python"])).json()["id"]
    c1, _ = _candidate(client, db_session, "s1@example.com", "S One", ["Python", "Django"], PY_LINE, job)

    def _down(**kw):
        if kw["schema"] is QueryParse:
            raise AppError(503, "LLM_UNAVAILABLE", "down")
        return kw["schema"].model_validate({"explanation": "Fake.", "learning_suggestions": []})

    monkeypatch.setattr("app.services.llm.generate_json", _down)
    _login(client, REC)
    r = _search(client, "python django", job)
    assert r.status_code == 200
    assert r.headers["X-Search-Mode"] == "embeddings-only"
    assert r.headers["X-Search-Fallback-Reason"] == "LLM_UNAVAILABLE"
    hits = r.json()
    assert hits[0]["candidate_id"] == c1
    assert "python" in [t.lower() for t in hits[0]["matched_terms"]]


def test_search_empty_pool_validation_and_strict_experience(client, db_session):
    _register(client, REC, "recruiter", "Rec Boss")
    assert _search(client, "Python developer").json() == []
    assert _search(client, "Python developer", limit=0).status_code == 422
    assert _search(client, "Python developer", limit=51).status_code == 422
    assert client.post("/api/v1/talent/search", json={"query": " "}).status_code == 422

    job = client.post("/api/v1/jobs", json=_job("Backend Developer", ["Python"])).json()["id"]
    _candidate(client, db_session, "s1@example.com", "S One", ["Python"], PY_LINE, job)  # 3.0 years
    _login(client, REC)
    assert len(_search(client, "Python developer, at least 2 years", job).json()) == 1
    assert _search(client, "Python developer, at least 8 years", job).json() == []  # explicit "at least": hard filter


def test_candidate_blocked_from_search_and_duplicates(client, db_session):
    _register(client, REC, "recruiter", "Rec Boss")
    _register(client, "s1@example.com", "candidate", "S One")
    assert _search(client, "Python developer").status_code == 403
    assert client.get("/api/v1/talent/duplicates").status_code == 403
    assert client.post("/api/v1/talent/duplicates/1/dismiss").status_code == 403
    assert client.post("/api/v1/talent/duplicates/1/merge",
                       json={"primary_candidate_id": 1, "reason": "same person"}).status_code == 403


# ---------- duplicates ----------
def test_duplicates_by_email_phone_and_text(client, db_session):
    _register(client, REC, "recruiter", "Rec Boss")
    job = client.post("/api/v1/jobs", json=_job("Backend Developer", ["Python"])).json()["id"]
    d1, _ = _candidate(client, db_session, "d1@example.com", "Jane Doe", ["Python", "Django"],
                       "Built Django shops at Acme", job, resume_email="Jane.Doe@gmail.com")
    d2, _ = _candidate(client, db_session, "d2@example.com", "J Doe", ["React", "TypeScript"],
                       "Frontend dashboards at Beta", job, resume_email="janedoe+jobs@gmail.com")
    d3, _ = _candidate(client, db_session, "d3@example.com", "Ali Khan", ["Java", "Spring", "MySQL"],
                       "Banking services at Gamma", job, resume_phone="+92 300 1234567")
    d4, _ = _candidate(client, db_session, "d4@example.com", "A Khan", ["Go", "Kubernetes", "Terraform"],
                       "Cloud platform at Delta", job, resume_phone="0300-1234567")
    same = ["Rust", "Embedded", "Firmware"]
    d5, _ = _candidate(client, db_session, "d5@example.com", "Sam Five", same, "Firmware drivers at Epsilon", job)
    d6, _ = _candidate(client, db_session, "d6@example.com", "Samuel Six", same, "Firmware drivers at Epsilon", job)
    _candidate(client, db_session, "d7@example.com", "Odd One", ["Ruby", "Rails", "Redis"], "Storefronts at Zeta", job)

    _login(client, REC)
    items = client.get("/api/v1/talent/duplicates").json()
    by_pair = {(i["candidate_a"]["candidate_id"], i["candidate_b"]["candidate_id"]): i for i in items}
    assert set(by_pair) == {tuple(sorted((d1, d2))), tuple(sorted((d3, d4))), tuple(sorted((d5, d6)))}
    assert all(a < b for a, b in by_pair)
    assert by_pair[tuple(sorted((d1, d2)))]["reasons"] == ["Same normalized email"]
    assert by_pair[tuple(sorted((d3, d4)))]["reasons"] == ["Same phone number"]
    text_pair = by_pair[tuple(sorted((d5, d6)))]
    assert text_pair["reasons"] == ["Resume text 100% similar"] and text_pair["similarity"] >= 0.92
    assert client.get("/api/v1/talent/duplicates").json() == items  # stable, no duplicate rows


def _make_pair(client, db_session, two_jobs=False):
    _register(client, REC, "recruiter", "Rec Boss")
    job_a = client.post("/api/v1/jobs", json=_job("Backend Developer", ["Python"])).json()["id"]
    job_b = client.post("/api/v1/jobs", json=_job("Platform Engineer", ["Python"])).json()["id"] if two_jobs else None
    p, p_a = _candidate(client, db_session, "p@example.com", "Pat Primary", ["Python"], PY_LINE, job_a,
                        resume_email="pat.primary@gmail.com")
    q, q_a = _candidate(client, db_session, "q@example.com", "Pat Q", ["Go"], "Services at Acme", job_a,
                        resume_email="patprimary+x@gmail.com")
    q_b = None
    if job_b:
        res = client.post(f"/api/v1/jobs/{job_b}/apply")
        assert res.status_code == 201
        q_b = res.json()["id"]
    _login(client, REC)
    return {"p": p, "q": q, "p_a": p_a, "q_a": q_a, "q_b": q_b, "job_a": job_a, "job_b": job_b}


def test_dismiss_and_dismissed_pairs_do_not_reappear(client, db_session):
    _make_pair(client, db_session)
    items = client.get("/api/v1/talent/duplicates").json()
    assert len(items) == 1
    pair_id = items[0]["id"]

    _register(client, REC2, "recruiter", "Rec Two")
    assert client.post(f"/api/v1/talent/duplicates/{pair_id}/dismiss").status_code == 404  # not their row

    _login(client, REC)
    r = client.post(f"/api/v1/talent/duplicates/{pair_id}/dismiss")
    assert r.status_code == 200 and r.json() == {"id": pair_id, "status": "dismissed"}
    assert client.get("/api/v1/talent/duplicates").json() == []  # rescan does not bring it back
    assert client.get("/api/v1/talent/duplicates").json() == []
    rows = db_session.scalars(select(DuplicateCandidate)).all()
    assert len(rows) == 1 and rows[0].status == "dismissed" and rows[0].resolved_at is not None
    assert client.post(f"/api/v1/talent/duplicates/{pair_id}/dismiss").status_code == 409


def test_merge_moves_non_conflicting_applications_and_audits(client, db_session):
    s = _make_pair(client, db_session, two_jobs=True)
    pair_id = client.get("/api/v1/talent/duplicates").json()[0]["id"]
    url = f"/api/v1/talent/duplicates/{pair_id}/merge"
    body = {"primary_candidate_id": s["p"], "reason": "Same person, two accounts"}

    _register(client, REC2, "recruiter", "Rec Two")
    assert client.post(url, json=body).status_code == 404  # another recruiter

    _login(client, REC)
    assert client.post(url, json={**body, "reason": "no"}).status_code == 422  # reason too short
    assert client.post(url, json={**body, "primary_candidate_id": 999999}).status_code == 422  # not in the pair

    r = client.post(url, json=body)
    assert r.status_code == 200, r.text
    assert r.json() == {"moved_application_ids": [s["q_b"]], "skipped_application_ids": [s["q_a"]]}

    db_session.expire_all()
    assert db_session.get(Application, s["q_b"]).candidate_id == s["p"]  # moved
    assert db_session.get(Application, s["q_a"]).candidate_id == s["q"]  # conflict: left in place
    audit = db_session.scalars(select(AuditLog).where(AuditLog.application_id == s["q_b"])).all()
    merged = [a for a in audit if (a.reason or "").startswith("Merged duplicate candidate")]
    assert len(merged) == 1
    assert merged[0].from_status == merged[0].to_status == db_session.get(Application, s["q_b"]).status
    assert merged[0].changed_by == "Rec Boss" and "Same person, two accounts" in merged[0].reason
    assert db_session.scalars(select(AuditLog).where(AuditLog.application_id == s["q_a"],
                                                     AuditLog.reason.like("Merged duplicate%"))).all() == []

    # Non-destructive: accounts and resumes remain.
    assert db_session.get(User, s["q"]) is not None
    assert db_session.scalar(select(Resume).where(Resume.candidate_id == s["q"])) is not None

    assert client.get("/api/v1/talent/duplicates").json() == []  # pair is merged now
    assert client.post(url, json=body).status_code == 409
    assert client.post(f"/api/v1/talent/duplicates/{pair_id}/dismiss").status_code == 409