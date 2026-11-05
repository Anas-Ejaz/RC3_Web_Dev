"""Phase 6: questions, scheduling + conflict detection, feedback, decisions, notifications.

Embeddings and the LLM are faked at their network boundary only; all application code runs for real.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.models.candidate import Resume

PW = "Str0ng-Passw0rd"
REC, REC2, CAND, CAND2 = "rec@example.com", "rec2@example.com", "cand@example.com", "cand2@example.com"
TEXT = "Skills: Python, Django\nBackend Developer at Acme 2020-2023\nBuilt APIs with Django"
JOB = {
    "title": "Backend Developer", "department": "Eng", "location": "Remote", "type": "full_time",
    "description": "Python Django", "required_skills": [{"name": "Python", "importance": 5}, {"name": "Django", "importance": 5}],
    "preferred_skills": [], "min_experience_years": 2, "qualifications": [],
}
_SK = {"normalized_name": "", "evidence_excerpt": "Skills: Python, Django", "verified": True, "edited_by": "ai"}
RESUME = {
    "skills": [{**_SK, "name": "Python", "normalized_name": "Python"}, {**_SK, "name": "Django", "normalized_name": "Django"}],
    "education": [], "unsupported_claims": [],
    "projects": [{"name": "Shop", "description": "API", "technologies": ["Django"], "evidence_excerpt": "Built APIs with Django"}],
    "experience": [{"title": "Backend Developer", "company": "Acme", "start": "2020", "end": "2023", "years": 3.0,
                    "summary": "", "evidence_excerpt": "Backend Developer at Acme 2020-2023"}],
}
_IDX: dict[str, int] = {}
_BASE = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=48)


def _fake_embed(texts):
    out = []
    for t in texts:
        i = _IDX.setdefault(t.lower(), len(_IDX))
        vec = [0.0] * 512
        vec[i] = 1.0
        out.append(vec)
    return out


def _fake_llm(**kw):
    fields = kw["schema"].model_fields
    if "questions" in fields:
        qs = [{"text": f"Role question {d} number {i}?", "difficulty": d, "category": "role", "answer_guideline": "Cover the basics."}
              for d in ("beginner", "intermediate", "advanced") for i in range(3)]
        qs.append({"text": "Walk me through the design choices in the Shop project?", "difficulty": "advanced",
                   "category": "project", "answer_guideline": "Trade-offs and own contribution."})
        return kw["schema"].model_validate({"questions": qs})
    if "answer_guideline" in fields:
        return kw["schema"].model_validate({"text": "A brand new regenerated question?", "answer_guideline": "New guide."})
    return kw["schema"].model_validate({"explanation": "Fake explanation.", "learning_suggestions": []})


@pytest.fixture(autouse=True)
def fake_ai(monkeypatch):
    monkeypatch.setattr("app.services.embeddings.embed", _fake_embed)
    monkeypatch.setattr("app.services.llm.generate_json", _fake_llm)


def at(minutes: int = 0) -> str:
    return (_BASE + timedelta(minutes=minutes)).isoformat()


def _register(client, email, role, name):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": PW, "full_name": name, "role": role})
    assert r.status_code == 201
    return r.json()


def _login(client, email):
    assert client.post("/api/v1/auth/login", json={"email": email, "password": PW}).status_code == 200


def _candidate_applies(client, db_session, email, name, job_id):
    cand = _register(client, email, "candidate", name)
    db_session.add(Resume(candidate_id=cand["id"], parse_status="parsed", raw_text=TEXT, **RESUME))
    db_session.commit()
    res = client.post(f"/api/v1/jobs/{job_id}/apply")
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _world(client, db_session):
    """Recruiter + job, two candidates who applied, a second recruiter; both applications shortlisted."""
    rec = _register(client, REC, "recruiter", "Rec Boss")
    job = client.post("/api/v1/jobs", json=JOB).json()
    app1 = _candidate_applies(client, db_session, CAND, "Cand One", job["id"])
    app2 = _candidate_applies(client, db_session, CAND2, "Cand Two", job["id"])
    rec2 = _register(client, REC2, "recruiter", "Rec Two")
    _login(client, REC)
    for a in (app1, app2):
        assert client.post(f"/api/v1/applications/{a}/status", json={"to_status": "shortlisted", "reason": "ok"}).status_code == 200
    return {"rec": rec, "rec2": rec2, "job": job, "app1": app1, "app2": app2}


def _iv(app_id, interviewer_id, when, **extra):
    return {"application_id": app_id, "scheduled_at": when, "duration_minutes": 60, "interviewer_id": interviewer_id,
            "type": "technical", "location_or_link": "https://meet.example.com/room", **extra}


FB = {"ratings": {"technical": 4, "communication": 5, "problem_solving": 4, "culture": 5},
      "strengths": "Strong system design", "concerns": "None", "recommendation": "yes"}


# ---------- scheduling ----------
def test_schedule_moves_to_interview_audits_and_notifies(client, db_session):
    w = _world(client, db_session)
    res = client.post("/api/v1/interviews", json=_iv(w["app1"], w["rec"]["id"], at()))
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "scheduled" and res.json()["candidate_name"] == "Cand One"

    detail = client.get(f"/api/v1/applications/{w['app1']}").json()
    assert detail["application"]["status"] == "interview"
    last = detail["audit"][-1]
    assert (last["from_status"], last["to_status"], last["changed_by"]) == ("shortlisted", "interview", "Rec Boss")

    _login(client, CAND)
    notes = client.get("/api/v1/notifications").json()
    assert len(notes) == 1 and notes[0]["title"] == "Interview scheduled"
    _login(client, CAND2)
    assert client.get("/api/v1/notifications").json() == []  # candidates only see their own


def test_conflict_detection(client, db_session):
    w = _world(client, db_session)
    rid, r2id = w["rec"]["id"], w["rec2"]["id"]
    first = client.post("/api/v1/interviews", json=_iv(w["app1"], rid, at())).json()

    # same interviewer, overlapping slot -> 409 with the contract body
    res = client.post("/api/v1/interviews", json=_iv(w["app2"], rid, at(30)))
    body = res.json()
    assert res.status_code == 409 and body["code"] == "SCHEDULING_CONFLICT"
    assert body["conflicts"][0]["interview_id"] == first["id"]
    assert body["conflicts"][0]["with"] == "Cand One" and body["conflicts"][0]["scheduled_at"]

    # back-to-back is allowed
    assert client.post("/api/v1/interviews", json=_iv(w["app2"], rid, at(60))).status_code == 201

    # same candidate, different interviewer, overlapping -> candidate conflict
    res = client.post("/api/v1/interviews", json=_iv(w["app1"], r2id, at(15)))
    assert res.status_code == 409 and res.json()["conflicts"][0]["kind"] == "candidate"

    # force overrides
    assert client.post("/api/v1/interviews", json=_iv(w["app2"], rid, at(30), force=True)).status_code == 201


def test_schedule_validation(client, db_session):
    w = _world(client, db_session)
    past = client.post("/api/v1/interviews", json=_iv(w["app1"], w["rec"]["id"], at(-60 * 24 * 3)))
    assert past.status_code == 422 and past.json()["code"] == "SCHEDULE_IN_PAST"
    bad = client.post("/api/v1/interviews", json=_iv(w["app1"], 999999, at()))
    assert bad.status_code == 422 and bad.json()["code"] == "INVALID_INTERVIEWER"


def test_update_and_cancel(client, db_session):
    w = _world(client, db_session)
    iv = client.post("/api/v1/interviews", json=_iv(w["app1"], w["rec"]["id"], at())).json()
    moved = client.put(f"/api/v1/interviews/{iv['id']}", json={"scheduled_at": at(180)})
    assert moved.status_code == 200
    cancelled = client.put(f"/api/v1/interviews/{iv['id']}", json={"status": "cancelled"})
    assert cancelled.json()["status"] == "cancelled"
    assert client.put(f"/api/v1/interviews/{iv['id']}", json={"scheduled_at": at(240)}).json()["code"] == "INTERVIEW_NOT_EDITABLE"
    # a cancelled slot no longer blocks scheduling
    assert client.post("/api/v1/interviews", json=_iv(w["app2"], w["rec"]["id"], at(180))).status_code == 201


# ---------- feedback + decision ----------
def test_feedback_decision_and_privacy(client, db_session):
    w = _world(client, db_session)
    iv = client.post("/api/v1/interviews", json=_iv(w["app1"], w["rec2"]["id"], at())).json()

    _login(client, REC2)  # the assigned interviewer can give feedback but owns nothing else
    res = client.post(f"/api/v1/interviews/{iv['id']}/feedback", json=FB)
    assert res.status_code == 200 and res.json()["status"] == "completed" and len(res.json()["feedback"]) == 1
    assert client.post(f"/api/v1/interviews/{iv['id']}/feedback", json=FB).json()["feedback"].__len__() == 1  # upsert
    assert client.put(f"/api/v1/interviews/{iv['id']}", json={"scheduled_at": at(500)}).status_code == 404
    assert client.get(f"/api/v1/applications/{w['app1']}").status_code == 404
    assert client.post(f"/api/v1/applications/{w['app1']}/decision", json={"decision": "selected", "reason": "x" * 5}).status_code == 404

    _login(client, REC)
    bad = {**FB, "ratings": {**FB["ratings"], "technical": 6}}
    assert client.post(f"/api/v1/interviews/{iv['id']}/feedback", json=bad).status_code == 422
    assert client.post(f"/api/v1/applications/{w['app1']}/decision", json={"decision": "selected"}).status_code == 422
    # shortlisted (never interviewed) cannot be decided
    assert client.post(f"/api/v1/applications/{w['app2']}/decision", json={"decision": "selected", "reason": "fine"}).json()["code"] == "INVALID_TRANSITION"

    ok = client.post(f"/api/v1/applications/{w['app1']}/decision", json={"decision": "selected", "reason": "Strong system design"})
    assert ok.status_code == 200 and ok.json()["status"] == "selected"
    last = client.get(f"/api/v1/applications/{w['app1']}/audit").json()[-1]
    assert (last["to_status"], last["reason"], last["changed_by"]) == ("selected", "Strong system design", "Rec Boss")

    _login(client, CAND)
    notes = client.get("/api/v1/notifications").json()
    decision = next(n for n in notes if n["kind"] == "decision")
    assert "selected" in decision["message"] and "Strong system design" not in decision["message"]


# ---------- questions ----------
def test_question_generate_edit_delete_regenerate(client, db_session):
    w = _world(client, db_session)
    res = client.post(f"/api/v1/applications/{w['app1']}/questions/generate",
                      json={"counts": {"beginner": 1, "intermediate": 2, "advanced": 0}, "include_project_questions": True})
    assert res.status_code == 200, res.text
    qs = res.json()
    role = [q for q in qs if q["category"] == "role"]
    assert [q["difficulty"] for q in role] == ["beginner", "intermediate", "intermediate"]
    assert len([q for q in qs if q["category"] == "project"]) == 1
    assert all(q["answer_guideline"] for q in qs)

    qid = qs[0]["id"]
    edited = client.put(f"/api/v1/questions/{qid}", json={"text": "Edited question text here?"})
    assert edited.status_code == 200 and edited.json()["text"] == "Edited question text here?"
    regen = client.post(f"/api/v1/questions/{qid}/regenerate")
    assert regen.status_code == 200 and regen.json()["text"] == "A brand new regenerated question?"
    assert regen.json()["difficulty"] == qs[0]["difficulty"]

    _login(client, REC2)  # another recruiter must not reach them
    assert client.get(f"/api/v1/applications/{w['app1']}/questions").status_code == 404
    assert client.put(f"/api/v1/questions/{qid}", json={"text": "Hacked question text?"}).status_code == 404
    assert client.delete(f"/api/v1/questions/{qid}").status_code == 404

    _login(client, REC)
    assert client.delete(f"/api/v1/questions/{qid}").status_code == 204
    assert len(client.get(f"/api/v1/applications/{w['app1']}/questions").json()) == len(qs) - 1


# ---------- access control ----------
def test_candidate_blocked_from_interview_routes(client, db_session):
    w = _world(client, db_session)
    _login(client, CAND)
    for method, path, body in [
        ("get", "/api/v1/interviewers", None),
        ("get", "/api/v1/interviews", None),
        ("post", "/api/v1/interviews", _iv(w["app1"], w["rec"]["id"], at())),
        ("put", "/api/v1/interviews/1", {"status": "cancelled"}),
        ("post", "/api/v1/interviews/1/feedback", FB),
        ("post", f"/api/v1/applications/{w['app1']}/decision", {"decision": "selected", "reason": "because"}),
        ("post", f"/api/v1/applications/{w['app1']}/questions/generate", {}),
        ("get", f"/api/v1/applications/{w['app1']}/questions", None),
        ("put", "/api/v1/questions/1", {"text": "Some new text here"}),
        ("post", "/api/v1/questions/1/regenerate", None),
        ("delete", "/api/v1/questions/1", None),
    ]:
        res = getattr(client, method)(path, **({"json": body} if body is not None else {}))
        assert res.status_code == 403, (method, path, res.status_code)
    assert client.get("/api/v1/notifications").status_code == 200  # allowed, but only own rows