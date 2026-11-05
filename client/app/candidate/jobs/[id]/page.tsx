"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/brand";
import { ApplyPanel } from "@/components/candidate/apply-panel";
import { SectionCard } from "@/components/candidate/section-card";
import { SkillRequirements } from "@/components/candidate/skill-requirements";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useMyApplications } from "@/hooks/use-applications";
import { useResume } from "@/hooks/use-candidate";
import { useApply, useJob } from "@/hooks/use-jobs";
import { isApiError } from "@/lib/api";
import { JOB_TYPE_LABEL } from "@/lib/constants";
import { formatSalary, timeAgo } from "@/lib/utils";

export default function CandidateJobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const job = useJob(id);
  const resume = useResume();
  const applications = useMyApplications();
  const apply = useApply();

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link href="/candidate/jobs">
        <ArrowLeft aria-hidden />
        All jobs
      </Link>
    </Button>
  );

  if (job.isError) {
    if (isApiError(job.error) && job.error.status === 404) {
      return (
        <div className="space-y-4">
          {back}
          <EmptyState title="Job not found" description="This job may have been removed or is no longer open." />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {back}
        <ErrorState onRetry={() => job.refetch()} />
      </div>
    );
  }

  if (job.isPending) {
    return (
      <div className="space-y-4">
        {back}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const data = job.data;

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        title={data.title}
        description={`${data.department} · ${data.location} · ${JOB_TYPE_LABEL[data.type]}`}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <SectionCard title="About the role">
            <p className="whitespace-pre-line text-sm leading-relaxed text-forest-950">{data.description}</p>
          </SectionCard>
          <SectionCard title="Skills">
            <div className="space-y-6">
              <SkillRequirements title="Required" skills={data.required_skills} />
              <SkillRequirements title="Preferred" skills={data.preferred_skills} />
            </div>
          </SectionCard>
          {data.qualifications.length > 0 && (
            <SectionCard title="Qualifications">
              <ul className="list-disc space-y-1 pl-5 text-sm text-forest-950">
                {data.qualifications.map((qualification) => (
                  <li key={qualification}>{qualification}</li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <ApplyPanel
            job={data}
            hasResume={resume.data?.parse_status === "parsed"}
            isChecking={resume.isPending || applications.isPending}
            checkFailed={resume.isError || applications.isError}
            application={applications.data?.find((a) => a.job_id === data.id)}
            isApplying={apply.isPending}
            onApply={() => apply.mutate(data.id)}
          />
          <SectionCard title="Details">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-forest-900/60">Salary</dt>
                <dd className="font-medium text-forest-950">
                  {formatSalary(data.salary_min, data.salary_max, data.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-forest-900/60">Experience</dt>
                <dd className="font-medium text-forest-950">
                  {data.min_experience_years > 0
                    ? `${data.min_experience_years}+ years`
                    : "No minimum experience"}
                </dd>
              </div>
              <div>
                <dt className="text-forest-900/60">Posted</dt>
                <dd className="font-medium text-forest-950">{timeAgo(data.created_at)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}