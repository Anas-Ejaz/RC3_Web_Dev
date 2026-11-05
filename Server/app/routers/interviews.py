"""Interview questions, interviews, feedback, decisions, notifications.

Every route has a role dependency. Scheduling conflicts return the contract's 409 SCHEDULING_CONFLICT body.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_recruiter
from app.models.user import User
from app.schemas.application import ApplicationOut
from app.schemas.interview import (
    DecisionIn, FeedbackIn, GenerateIn, InterviewerOut, InterviewIn, InterviewOut, InterviewUpdate,
    NotificationOut, QuestionOut, QuestionUpdate,
)
from app.services import interviews as svc
from app.services import notifications as notif_svc
from app.services import questions as q_svc

router = APIRouter(tags=["interviews"])


def _conflict_response(exc: svc.SchedulingConflict) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content=jsonable_encoder({
            "detail": "The interviewer or candidate already has an overlapping interview. Resend with force=true to schedule anyway.",
            "code": "SCHEDULING_CONFLICT",
            "conflicts": exc.conflicts,
        }),
    )


# ---------- questions ----------
@router.post("/applications/{application_id}/questions/generate", response_model=list[QuestionOut])
def generate_questions(application_id: int, body: GenerateIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return q_svc.generate(db, user, application_id, body.counts.model_dump(), body.include_project_questions)


@router.get("/applications/{application_id}/questions", response_model=list[QuestionOut])
def list_questions(application_id: int, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return q_svc.list_for_application(db, user, application_id)


@router.put("/questions/{question_id}", response_model=QuestionOut)
def edit_question(question_id: int, body: QuestionUpdate, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return q_svc.update_question(db, user, question_id, body.model_dump(exclude_unset=True))


@router.delete("/questions/{question_id}", status_code=204)
def delete_question(question_id: int, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    q_svc.delete_question(db, user, question_id)
    return Response(status_code=204)


@router.post("/questions/{question_id}/regenerate", response_model=QuestionOut)
def regenerate_question(question_id: int, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return q_svc.regenerate(db, user, question_id)


# ---------- interviews ----------
@router.get("/interviewers", response_model=list[InterviewerOut])
def interviewers(_: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return [InterviewerOut(id=u.id, full_name=u.full_name) for u in svc.list_interviewers(db)]


@router.post("/interviews", response_model=InterviewOut, status_code=201)
def create_interview(body: InterviewIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    try:
        return svc.schedule(db, user, body)
    except svc.SchedulingConflict as exc:
        return _conflict_response(exc)


@router.get("/interviews", response_model=list[InterviewOut])
def list_interviews(
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    interviewer_id: int | None = None,
    user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    return svc.list_interviews(db, user, from_=from_, to=to, interviewer_id=interviewer_id)


@router.put("/interviews/{interview_id}", response_model=InterviewOut)
def update_interview(interview_id: int, body: InterviewUpdate, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    try:
        return svc.update_interview(db, user, interview_id, body)
    except svc.SchedulingConflict as exc:
        return _conflict_response(exc)


@router.post("/interviews/{interview_id}/feedback", response_model=InterviewOut)
def feedback(interview_id: int, body: FeedbackIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.submit_feedback(db, user, interview_id, body)


@router.post("/applications/{application_id}/decision", response_model=ApplicationOut)
def decision(application_id: int, body: DecisionIn, user: User = Depends(require_recruiter), db: Session = Depends(get_db)):
    return svc.decide(db, user, application_id, body.decision, body.reason)


# ---------- notifications (any logged-in user, own rows only) ----------
@router.get("/notifications", response_model=list[NotificationOut])
def notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return notif_svc.list_for_user(db, user.id)


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def read_notification(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Extra endpoint (not in contract)."""
    return notif_svc.mark_read(db, user.id, notification_id)