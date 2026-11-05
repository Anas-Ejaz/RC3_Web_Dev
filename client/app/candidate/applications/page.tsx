"use client";

import Link from "next/link";

import { PageHeader } from "@/components/brand";
import { ApplicationCard } from "@/components/candidate/application-card";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useMyApplications } from "@/hooks/use-applications";

export default function CandidateApplicationsPage() {
  const applications = useMyApplications();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Your"
        accent="applications"
        description="Follow each application from submission to a final decision."
      />
      {applications.isError ? (
        <ErrorState onRetry={() => applications.refetch()} />
      ) : applications.isPending ? (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : applications.data.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="When you apply to a job, you can follow its progress here."
          action={
            <Button asChild variant="lime">
              <Link href="/candidate/jobs">Browse jobs</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {applications.data.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </div>
  );
}