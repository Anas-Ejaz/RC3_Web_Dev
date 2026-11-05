import type { Assessment } from "@/types/api";

/** The score recruiters act on: the override when there is one, otherwise the AI score. */
export function effectiveScore(assessment?: Assessment | null): number | null {
  if (!assessment) return null;
  return assessment.overridden && assessment.override_score != null
    ? assessment.override_score
    : assessment.overall_score;
}