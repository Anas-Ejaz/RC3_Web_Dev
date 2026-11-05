"""AI interview question generation, grounded in the job, the computed assessment and verified resume data.

The prompt never receives the candidate's name or any personal attribute. Only projects with a verified
evidence excerpt are used for project questions. Results are cleaned and trimmed in code to the requested counts.
"""
import json

from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.models.application import Application
from app.models.interview import InterviewQuestion
from app.models.job import Job
from app.models.user import User
from app.services import llm
from app.services.applications import get_owned_application

DIFFS = ("beginner", "intermediate", "advanced")
MAX_PROJECT_QUESTIONS = 3


class _LLMQuestion(BaseModel):
    text: str = ""
    difficulty: str = ""
    category: str = ""
    answer_guideline: str = ""


class _LLMQuestions(BaseModel):
    questions: list[_LLMQuestion] = Field(default_factory=list)


class _LLMOne(BaseModel):
    text: str = ""
    answer_guideline: str = ""


_RULES = """- Ask only about job-relevant skills and experience. Never ask about or refer to age, gender, nationality, religion, family, health or other personal attributes.
- For skills whose evidence is "no_evidence_found" or "weak_evidence", ask exploratory questions that let the candidate show experience. Never assume the candidate lacks a skill.
- answer_guideline: 2-4 sentences describing what a strong answer covers, written for the interviewer. It is guidance, not a score.
- category "role" tests a skill from job_skills. category "project" must name one project from "projects" and probe design decisions, trade-offs and the candidate's own contribution."""

_SYSTEM = f"""You write structured interview questions for a recruiter, grounded ONLY in the JSON you receive.
Output JSON: {{"questions": [{{"text": string, "difficulty": "beginner"|"intermediate"|"advanced", "category": "role"|"project", "answer_guideline": string}}]}}
Rules:
- Produce exactly requested_role_questions[difficulty] questions with category "role" for each difficulty, and exactly project_question_count questions with category "project" (project questions use difficulty intermediate or advanced).
{_RULES}"""

_SYSTEM_ONE = f"""You write ONE replacement interview question for a recruiter, grounded ONLY in the JSON you receive.
Output JSON: {{"text": string, "answer_guideline": string}}
Rules:
- The question must have the given difficulty and category and must be different from every entry in avoid_these_questions.
{_RULES}"""


def _context(app: Application, job: Job) -> dict:
    """Facts for the prompt. No name, contact details or other personal attributes."""
    assessment = app.assessment or {}
    resume = app.resume_data or {}
    job_skills = [
        {"skill": r["skill"], "required": r["required"], "importance": r["importance"], "evidence": r["state"]}
        for r in assessment.get("skill_results", [])
    ] or [
        {"skill": s["name"], "required": True, "importance": s["importance"], "evidence": "not_assessed"}
        for s in job.required_skills
    ]
    return {
        "job_title": job.title,
        "job_skills": job_skills,
        "verified_resume_skills": [s["normalized_name"] for s in resume.get("skills", []) if s.get("verified")][:30],
        "projects": [
            {"name": p.get("name"), "description": (p.get("description") or "")[:300], "technologies": p.get("technologies") or []}
            for p in resume.get("projects", []) if p.get("evidence_excerpt")
        ][:5],
        "experience": [
            {"title": e.get("title"), "summary": (e.get("summary") or "")[:200]}
            for e in resume.get("experience", []) if e.get("evidence_excerpt")
        ][:5],
    }


def _select(items: list[_LLMQuestion], counts: dict[str, int], project_n: int) -> list[tuple[str, str, str, str]]:
    """Drop invalid/duplicate questions and trim to the requested counts. Returns (text, difficulty, category, guideline)."""
    role: dict[str, list] = {d: [] for d in DIFFS}
    project: list = []
    seen: set[str] = set()
    for q in items:
        text = (q.text or "").strip()
        diff = (q.difficulty or "").strip().lower()
        cat = (q.category or "").strip().lower()
        if len(text) < 10 or diff not in DIFFS or cat not in ("role", "project") or text.lower() in seen:
            continue
        seen.add(text.lower())
        entry = (text[:1000], diff, cat, (q.answer_guideline or "").strip()[:3000])
        if cat == "project":
            if len(project) < project_n:
                project.append(entry)
        elif len(role[diff]) < counts.get(diff, 0):
            role[diff].append(entry)
    return [e for d in DIFFS for e in role[d]] + project


def list_questions(db: Session, application_id: int) -> list[InterviewQuestion]:
    rows = db.scalars(select(InterviewQuestion).where(InterviewQuestion.application_id == application_id)).all()
    rank = {d: i for i, d in enumerate(DIFFS)}
    return sorted(rows, key=lambda q: (q.category == "project", rank.get(q.difficulty, 9), q.id))


def list_for_application(db: Session, user: User, application_id: int) -> list[InterviewQuestion]:
    app = get_owned_application(db, application_id, user)
    return list_questions(db, app.id)


def generate(db: Session, user: User, application_id: int, counts: dict[str, int], include_project: bool) -> list[InterviewQuestion]:
    """Generate questions via Groq. Replaces the application's existing questions (only after a usable result)."""
    app = get_owned_application(db, application_id, user)
    job = db.get(Job, app.job_id)
    ctx = _context(app, job)
    project_n = min(MAX_PROJECT_QUESTIONS, len(ctx["projects"])) if include_project else 0
    if sum(counts.values()) + project_n == 0:
        raise AppError(422, "NOTHING_TO_GENERATE", "No questions requested (and no verified projects for project questions)")

    out = llm.generate_json(
        model=settings.groq_model_explain, system=_SYSTEM, schema=_LLMQuestions, temperature=0.4,
        user=json.dumps({**ctx, "requested_role_questions": counts, "project_question_count": project_n}),
    )
    rows = _select(out.questions, counts, project_n)
    if not rows:
        raise AppError(502, "LLM_INVALID_OUTPUT", "The AI did not return usable questions. Please retry.")

    db.execute(delete(InterviewQuestion).where(InterviewQuestion.application_id == app.id))
    db.add_all(
        InterviewQuestion(application_id=app.id, text=t, difficulty=d, category=c, answer_guideline=g)
        for t, d, c, g in rows
    )
    db.commit()
    return list_questions(db, app.id)


def get_owned_question(db: Session, question_id: int, user: User) -> tuple[InterviewQuestion, Application]:
    """A question is reachable only through an application on a job the recruiter owns."""
    from app.models.job import Job as _Job  # local alias keeps the join readable

    row = db.execute(
        select(InterviewQuestion, Application)
        .join(Application, Application.id == InterviewQuestion.application_id)
        .join(_Job, _Job.id == Application.job_id)
        .where(InterviewQuestion.id == question_id, _Job.recruiter_id == user.id)
    ).first()
    if row is None:
        raise AppError(404, "QUESTION_NOT_FOUND", "Question not found")
    return row[0], row[1]


def update_question(db: Session, user: User, question_id: int, data: dict) -> InterviewQuestion:
    q, _ = get_owned_question(db, question_id, user)
    if data.get("text") is not None:
        q.text = data["text"].strip()
    if data.get("difficulty") is not None:
        q.difficulty = data["difficulty"]
    if data.get("answer_guideline") is not None:
        q.answer_guideline = data["answer_guideline"].strip()
    db.commit()
    db.refresh(q)
    return q


def delete_question(db: Session, user: User, question_id: int) -> None:
    q, _ = get_owned_question(db, question_id, user)
    db.delete(q)
    db.commit()


def regenerate(db: Session, user: User, question_id: int) -> InterviewQuestion:
    """Replace one question with a new one of the same difficulty and category."""
    q, app = get_owned_question(db, question_id, user)
    job = db.get(Job, app.job_id)
    others = [x.text for x in list_questions(db, app.id)]  # includes the current text on purpose
    out = llm.generate_json(
        model=settings.groq_model_explain, system=_SYSTEM_ONE, schema=_LLMOne, temperature=0.6,
        user=json.dumps({**_context(app, job), "difficulty": q.difficulty, "category": q.category, "avoid_these_questions": others}),
    )
    text = (out.text or "").strip()
    if len(text) < 10:
        raise AppError(502, "LLM_INVALID_OUTPUT", "The AI did not return a usable question. Please retry.")
    q.text = text[:1000]
    q.answer_guideline = (out.answer_guideline or "").strip()[:3000]
    db.commit()
    db.refresh(q)
    return q