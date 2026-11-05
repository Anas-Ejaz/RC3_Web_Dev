// Mirrors SHARED API CONTRACT v1. Shapes marked ASSUMED are not defined by the contract.

export type Role = "recruiter" | "candidate";
export type JobType = "full_time" | "part_time" | "contract" | "internship";
export type JobStatus = "open" | "closed";
export type ApplicationStatus =
  | "submitted"
  | "parsed"
  | "ai_assessment_available"
  | "recruiter_review"
  | "shortlisted"
  | "rejected"
  | "interview"
  | "selected"
  | "not_selected";
export type EvidenceState = "confirmed" | "weak_evidence" | "no_evidence_found";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type InterviewType = "technical" | "hr" | "managerial" | "panel";
export type ParseStatus = "pending" | "parsed" | "failed" | "empty" | "unsupported";
export type Recommendation = "strong_yes" | "yes" | "no" | "strong_no";

export interface ApiErrorBody {
  detail: string;
  code: string;
  fields?: Record<string, string>;
  [key: string]: unknown;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

export interface SkillReq {
  name: string;
  importance: number; // 1-5
}

export interface Job {
  id: number;
  title: string;
  department: string;
  location: string;
  type: JobType;
  salary_min: number | null; // CHANGED: was number
  salary_max: number | null; // CHANGED: was number
  currency: string;
  description: string;
  required_skills: SkillReq[];
  preferred_skills: SkillReq[];
  min_experience_years: number;
  qualifications: string[];
  status: JobStatus;
  applicant_count: number;
  created_at: string;
}

export type JobInput = Omit<Job, "id" | "status" | "applicant_count" | "created_at">;

export interface ExtractedRequirements {
  required_skills: SkillReq[];
  preferred_skills: SkillReq[];
  min_experience_years: number;
  qualifications: string[];
}

export interface ResumeSkill {
  name: string;
  normalized_name: string;
  evidence_excerpt: string;
  verified: boolean;
  edited_by: "ai" | "candidate" | "recruiter";
}
export interface ResumeEducation {
  degree: string;
  institution: string;
  year: string;
  evidence_excerpt: string;
}
export interface ResumeExperience {
  title: string;
  company: string;
  start: string;
  end: string;
  years: number;
  summary: string;
  evidence_excerpt: string;
}
export interface ResumeProject {
  name: string;
  description: string;
  technologies: string[];
  evidence_excerpt: string;
}
export interface UnsupportedClaim {
  claim: string;
  reason: string;
}

export interface ParsedResume {
  id: number;
  parse_status: ParseStatus;
  error_message?: string;
  name: string;
  email: string;
  phone: string;
  links: string[];
  skills: ResumeSkill[];
  education: ResumeEducation[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  unsupported_claims: UnsupportedClaim[];
}

export type ResumeCorrections = Pick<
  ParsedResume,
  "name" | "email" | "phone" | "links" | "skills" | "education" | "experience" | "projects"
>;

export interface BreakdownPart {
  score: number;
  weight: number;
}
export interface SkillResult {
  skill: string;
  importance: number;
  required: boolean;
  state: EvidenceState;
  similarity: number; // 0-1
  evidence_excerpt?: string;
}
export interface Assessment {
  overall_score: number;
  overridden: boolean;
  override_score?: number;
  override_reason?: string;
  breakdown: {
    skills: BreakdownPart;
    experience: BreakdownPart;
    projects: BreakdownPart;
    qualifications: BreakdownPart;
  };
  skill_results: SkillResult[];
  gaps: string[];
  learning_suggestions: string[];
  explanation: string;
  unsupported_claims: UnsupportedClaim[];
  generated_at: string;
}

export interface Application {
  id: number;
  job_id: number;
  candidate_id: number;
  candidate_name: string;
  status: ApplicationStatus;
  assessment?: Assessment;
  submitted_at: string;
  updated_at: string;
  // Candidate-safe list items may also carry the job title (ASSUMED convenience, optional)
  job_title?: string;
}

export interface CandidateProfile {
  headline: string;
  phone: string;
  location: string;
  interests: string[];
  summary: string;
}

export interface RecommendedJob {
  job: Job;
  match_score: number;
  matched_skills: string[];
  reason: string;
}

export interface Note {
  id: number;
  text: string;
  author: string;
  created_at: string;
} // ASSUMED

export interface AuditEntry {
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_by: string;
  reason?: string;
  created_at: string;
}

export interface ApplicationDetail {
  application: Application;
  resume: ParsedResume;
  assessment: Assessment;
  notes: Note[];
  audit: AuditEntry[];
}

export interface ComparisonItem {
  application_id: number;
  candidate_name: string;
  assessment: Assessment;
  key_evidence: string[];
  missing_info: string[];
}

export interface InterviewQuestion {
  id: number;
  text: string;
  difficulty: Difficulty;
  category: "role" | "project";
  answer_guideline: string;
}

export interface QuestionGenerateInput {
  counts: Record<Difficulty, number>;
  include_project_questions: boolean;
}

export interface Interviewer {
  id: number;
  full_name: string;
}

export interface InterviewFeedback {
  ratings: { technical: number; communication: number; problem_solving: number; culture: number };
  strengths: string;
  concerns: string;
  recommendation: Recommendation;
}

export interface Interview {
  id: number;
  application_id: number;
  candidate_name: string;
  job_title: string;
  scheduled_at: string;
  duration_minutes: number;
  interviewer_id: number;
  interviewer_name: string;
  type: InterviewType;
  location_or_link: string;
  status: "scheduled" | "completed";
  feedback?: InterviewFeedback;
} // ASSUMED

export interface InterviewInput {
  application_id: number;
  scheduled_at: string;
  duration_minutes: number;
  interviewer_id: number;
  type: InterviewType;
  location_or_link: string;
  force?: boolean;
}

export interface SchedulingConflict {
  interview_id: number;
  scheduled_at: string;
  with: string;
}

export interface AppNotification {
  id: number;
  message: string;
  created_at: string;
  read: boolean;
} // ASSUMED

export interface AnalyticsOverview {
  active_jobs: number;
  total_applications: number;
  shortlisted: number;
  pending_reviews: number;
  upcoming_interviews: number;
  shortlist_rate: number;
  avg_processing_days: number;
}
export interface ByJobStat {
  job_id: number;
  title: string;
  applications: number;
  shortlisted: number;
}
export interface FunnelStage {
  stage: string;
  count: number;
}
export interface SkillGap {
  skill: string;
  missing_count: number;
  percentage: number;
}

export interface TalentSearchResult {
  candidate_id: number;
  name: string;
  score: number;
  evidence_excerpts: string[];
  matched_terms: string[];
}

export interface TalentPoolEntry {
  candidate_id: number;
  name: string;
  last_job_title: string;
  last_score: number;
  reviewed_at: string;
  retention_expires_at: string;
  contact_permission: boolean;
} // ASSUMED

export interface DuplicateCandidate {
  id: number;
  name: string;
  email: string;
  phone: string;
  skills: string[];
} // ASSUMED

export interface DuplicatePair {
  id: number;
  candidate_a: DuplicateCandidate;
  candidate_b: DuplicateCandidate;
  similarity: number;
  reasons: string[];
}

export type FairnessAttribute = "name" | "gender" | "age" | "location";
export interface FairnessResult {
  original_score: number;
  variants: { attribute: FairnessAttribute; changed_to: string; score: number; delta: number }[];
  passed: boolean;
}