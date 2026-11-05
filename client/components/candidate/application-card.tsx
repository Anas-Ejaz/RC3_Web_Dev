import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline } from "@/components/shared/timeline";
import type { MyApplication } from "@/hooks/use-applications";
import { APPLICATION_STATUS_LABEL } from "@/lib/constants";
import { candidateTimeline, toCandidateStatus } from "@/lib/candidate-status";
import { formatDate, timeAgo } from "@/lib/utils";

const STATE_META = { done: "Completed", current: "Current stage", upcoming: "Upcoming" } as const;

export function ApplicationCard({ application }: { application: MyApplication }) {
  const items = candidateTimeline(application.status).map((step) => ({
    id: step.status,
    title: APPLICATION_STATUS_LABEL[step.status],
    meta: STATE_META[step.state],
    date:
      step.status === "submitted"
        ? application.submitted_at
        : step.state === "current"
          ? application.updated_at
          : undefined,
    active: step.state === "current",
  }));

  return (
    <article className="rounded-3xl bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-forest-950">
            <Link
              href={`/candidate/jobs/${application.job_id}`}
              className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
            >
              {application.job_title ?? `Job #${application.job_id}`}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-forest-900/70">
            Applied {formatDate(application.submitted_at)} · Updated {timeAgo(application.updated_at)}
          </p>
        </div>
        <StatusBadge status={toCandidateStatus(application.status)} />
      </div>
      <div className="mt-6">
        <Timeline items={items} />
      </div>
    </article>
  );
}