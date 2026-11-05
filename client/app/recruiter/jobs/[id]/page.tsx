"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/brand";
import { JobForm } from "@/components/recruiter/job-form";
import { JobStatusToggle } from "@/components/recruiter/job-status-toggle";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useJob } from "@/hooks/use-jobs";
import { isApiError } from "@/lib/api";

export default function EditJobPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const job = useJob(id);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link href="/recruiter/jobs">
        <ArrowLeft aria-hidden />
        All jobs
      </Link>
    </Button>
  );

  if (job.isError) {
    return (
      <div className="space-y-4">
        {back}
        {isApiError(job.error) && job.error.status === 404 ? (
          <EmptyState title="Job not found" description="This job may have been removed." />
        ) : (
          <ErrorState onRetry={() => job.refetch()} />
        )}
      </div>
    );
  }

  if (job.isPending) {
    return (
      <div className="space-y-4">
        {back}
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        title="Edit"
        accent="job"
        description={job.data.title}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={job.data.status} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/recruiter/jobs/${job.data.id}/applicants`}>View applicants</Link>
            </Button>
            <JobStatusToggle job={job.data} variant="outline" />
          </div>
        }
      />
      <JobForm key={job.data.id} job={job.data} />
    </div>
  );
}