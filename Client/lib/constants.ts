import type {
  ApplicationStatus,
  Difficulty,
  EvidenceState,
  InterviewType,
  JobStatus,
  JobType,
} from "@/types/api";

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = { open: "Open", closed: "Closed" };

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  parsed: "Resume parsed",
  ai_assessment_available: "AI assessment ready",
  recruiter_review: "Under review",
  shortlisted: "Shortlisted",
  rejected: "Not progressing",
  interview: "Interview",
  selected: "Selected",
  not_selected: "Not selected",
};

/** Order used by timelines and funnels */
export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  "submitted",
  "parsed",
  "ai_assessment_available",
  "recruiter_review",
  "shortlisted",
  "interview",
  "selected",
];

export const EVIDENCE_LABEL: Record<EvidenceState, string> = {
  confirmed: "Confirmed",
  weak_evidence: "Weak evidence",
  no_evidence_found: "No evidence found",
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  technical: "Technical",
  hr: "HR",
  managerial: "Managerial",
  panel: "Panel",
};

export const BREAKDOWN_LABEL = {
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  qualifications: "Qualifications",
} as const;

export const AI_NOTICE = "AI recommendation only. The hiring decision is yours.";