import Link from "next/link";
import { MapPin } from "lucide-react";

import { JOB_TYPE_LABEL } from "@/lib/constants";
import { formatSalary, timeAgo } from "@/lib/utils";
import type { Job } from "@/types/api";

export function JobCard({ job }: { job: Job }) {
  return (
    <article className="rounded-3xl bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-forest-950">
            <Link
              href={`/candidate/jobs/${job.id}`}
              className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
            >
              {job.title}
            </Link>
          </h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-forest-900/70">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {job.department} · {job.location}
          </p>
        </div>
        <span className="rounded-full bg-cream-200 px-3 py-1 text-xs font-medium text-forest-950">
          {JOB_TYPE_LABEL[job.type]}
        </span>
      </div>
      <p className="mt-3 text-sm text-forest-950">{formatSalary(job.salary_min, job.salary_max, job.currency)}</p>
      {job.required_skills.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Required skills">
          {job.required_skills.slice(0, 5).map((skill) => (
            <li key={skill.name} className="rounded-full bg-lime-soft px-3 py-1 text-xs font-medium text-forest-950">
              {skill.name}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-forest-900/60">Posted {timeAgo(job.created_at)}</p>
    </article>
  );
}