"""Retention purge: dry-run changes nothing, apply blanks non-consenting old snapshots, audit logs survive."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update

from app.core.config import settings
from app.models.application import Application, AuditLog
from scripts.purge_retention import purge

PW = "Str0ng-Passw0rd"
P = settings.api_prefix


def _register(client, email, role, name):
    r = client.post(f"{P}/auth/register", json={"email": email, "password": PW, "full_name": name, "role": role})
    assert r.status_code == 201, r.text
    return r.json()


def _add_app(db, job_id, cand_id):
    a = Application(job_id=job_id, candidate_id=cand_id, status="recruiter_review",
                    resume_data={"skills": [{"name": "Python"}], "name": "X"}, resume_text="Skills: Python",
                    assessment={"overall_score": 70.0, "explanation": "text", "skill_results": [{"skill": "Python"}],
                                "gaps": ["g"], "generated_at": "2026-01-01T00:00:00Z"}, score=70.0)
    db.add(a)
    db.commit()
    return a


def test_purge_dry_run_then_apply(client, db_session):
    _register(client, "purge_rec@example.com", "recruiter", "Purge Rec")
    job = {"title": "Backend Developer", "department": "Eng", "location": "Remote", "type": "full_time", "description": "x",
           "required_skills": [{"name": "Python", "importance": 5}], "preferred_skills": [],
           "min_experience_years": 2, "qualifications": []}
    job_id = client.post(f"{P}/jobs", json=job).json()["id"]

    old_nc = _register(client, "purge_a@example.com", "candidate", "A")["id"]
    old_c = _register(client, "purge_b@example.com", "candidate", "B")["id"]
    client.put(f"{P}/candidate/talent-pool-consent", json={"consent": True})  # logged in as B
    recent_nc = _register(client, "purge_c@example.com", "candidate", "C")["id"]

    a, b, c = (_add_app(db_session, job_id, u) for u in (old_nc, old_c, recent_nc))
    old_date = datetime.now(timezone.utc) - timedelta(days=settings.talent_pool_retention_days + 30)
    db_session.execute(update(Application).where(Application.id.in_([a.id, b.id])).values(updated_at=old_date))
    db_session.add(AuditLog(application_id=a.id, from_status="submitted", to_status="recruiter_review",
                            changed_by="system", reason="r"))
    db_session.commit()
    audit_before = db_session.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.application_id == a.id))

    dry = purge(db_session)
    assert a.id in dry["application_ids"] and b.id not in dry["application_ids"] and c.id not in dry["application_ids"]
    assert dry["applied"] is False
    db_session.expire_all()
    assert db_session.get(Application, a.id).resume_text == "Skills: Python"  # dry-run changed nothing

    done = purge(db_session, apply=True)
    assert done["applied"] is True and a.id in done["application_ids"]
    db_session.expire_all()
    pa, pb, pc = (db_session.get(Application, x.id) for x in (a, b, c))
    assert pa.resume_text == "" and pa.resume_data["skills"] == [] and pa.resume_data["name"] is None
    assert set(pa.assessment) == {"overall_score", "generated_at"} and pa.score == 70.0
    assert pa.updated_at == old_date  # the purge does not restart the clock
    assert pb.resume_text == "Skills: Python"  # consenting candidate untouched
    assert pc.resume_text == "Skills: Python"  # still within retention
    assert db_session.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.application_id == a.id)) == audit_before
    assert a.id not in purge(db_session)["application_ids"]  # idempotent