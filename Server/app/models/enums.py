"""All contract enums in one place (str enums serialize to the contract's string values)."""
from enum import Enum


class Role(str, Enum):
    recruiter = "recruiter"
    candidate = "candidate"


class JobType(str, Enum):
    full_time = "full_time"
    part_time = "part_time"
    contract = "contract"
    internship = "internship"


class JobStatus(str, Enum):
    open = "open"
    closed = "closed"


class ApplicationStatus(str, Enum):
    submitted = "submitted"
    parsed = "parsed"
    ai_assessment_available = "ai_assessment_available"
    recruiter_review = "recruiter_review"
    shortlisted = "shortlisted"
    rejected = "rejected"
    interview = "interview"
    selected = "selected"
    not_selected = "not_selected"


class EvidenceState(str, Enum):
    confirmed = "confirmed"
    weak_evidence = "weak_evidence"
    no_evidence_found = "no_evidence_found"


class Difficulty(str, Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class InterviewType(str, Enum):
    technical = "technical"
    hr = "hr"
    managerial = "managerial"
    panel = "panel"