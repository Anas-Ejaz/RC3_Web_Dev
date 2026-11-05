import { APPLICATION_STATUS_LABEL, JOB_STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ApplicationStatus, JobStatus } from "@/types/api";

type AnyStatus = ApplicationStatus | JobStatus;

const STYLE: Record<AnyStatus, string> = {
  submitted: "bg-cream-300 text-forest-800",
  parsed: "bg-cream-300 text-forest-800",
  ai_assessment_available: "bg-sky-100 text-sky-900",
  recruiter_review: "bg-violet-100 text-violet-900",
  shortlisted: "bg-lime text-forest-900",
  rejected: "bg-stone-200 text-stone-700",
  interview: "bg-emerald-100 text-emerald-900",
  selected: "bg-forest-900 text-lime",
  not_selected: "bg-stone-200 text-stone-700",
  open: "bg-evidence-confirmed-bg text-evidence-confirmed-fg",
  closed: "bg-stone-200 text-stone-700",
};

export function StatusBadge({ status, className }: { status: AnyStatus; className?: string }) {
  const label = status === "open" || status === "closed" ? JOB_STATUS_LABEL[status] : APPLICATION_STATUS_LABEL[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", STYLE[status], className)}>
      {label}
    </span>
  );
}