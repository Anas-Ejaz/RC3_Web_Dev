import Link from "next/link";

import { JobStatusToggle } from "@/components/recruiter/job-status-toggle";
import { Button } from "@/components/ui/button";
import type { Job } from "@/types/api";

export function JobRowActions({ job }: { job: Job }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/recruiter/jobs/${job.id}/applicants`} aria-label={`Applicants for ${job.title}`}>
          Applicants
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/recruiter/jobs/${job.id}`} aria-label={`Edit ${job.title}`}>
          Edit
        </Link>
      </Button>
      <JobStatusToggle job={job} />
    </div>
  );
}