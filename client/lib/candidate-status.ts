import { APPLICATION_STATUS_ORDER } from "@/lib/constants";
import type { Application } from "@/types/api";

type Status = Application["status"];

export type StepState = "done" | "current" | "upcoming";

export interface CandidateStep {
  status: Status;
  state: StepState;
}

const HIDDEN_FROM_CANDIDATE: readonly Status[] = [
  "parsed",
  "ai_assessment_available",
  "rejected",
  "not_selected",
];

/** Collapses recruiter-only stages into candidate-safe ones. */
export function toCandidateStatus(status: Status): Status {
  if (status === "parsed" || status === "ai_assessment_available") return "submitted";
  if (status === "rejected") return "not_selected";
  return status;
}

export function candidateTimeline(status: Status): CandidateStep[] {
  const current: Status = toCandidateStatus(status);
  const visible: Status[] = (APPLICATION_STATUS_ORDER as readonly Status[]).filter(
    (s) => !HIDDEN_FROM_CANDIDATE.includes(s),
  );

  if (current === "not_selected") {
    const reviewIndex = visible.indexOf("recruiter_review");
    return [
      ...visible.slice(0, reviewIndex + 1).map((s): CandidateStep => ({ status: s, state: "done" })),
      { status: current, state: "current" },
    ];
  }

  const currentIndex = visible.indexOf(current);
  return visible.map((s, i): CandidateStep => ({
    status: s,
    state: i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
  }));
}

export function summarizeApplications(applications: { status: Status }[]) {
  const stages = applications.map((a) => toCandidateStatus(a.status));
  return {
    total: applications.length,
    inReview: stages.filter((s) => s === "submitted" || s === "recruiter_review").length,
    shortlisted: stages.filter((s) => s === "shortlisted" || s === "interview").length,
    decided: stages.filter((s) => s === "selected" || s === "not_selected").length,
  };
}