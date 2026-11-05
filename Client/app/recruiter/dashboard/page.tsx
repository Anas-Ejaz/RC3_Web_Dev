"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/brand";
import { ByJobChart, FunnelChart, SkillGapsChart } from "@/components/recruiter/dashboard-charts";
import { StatCard } from "@/components/recruiter/stat-card";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useByJob, useFunnel, useOverview, useSkillGaps } from "@/hooks/use-analytics";

function percent(rate: number) {
  const value = rate <= 1 ? rate * 100 : rate;
  return `${Math.round(value)}%`;
}

export default function RecruiterDashboardPage() {
  const overview = useOverview();
  const byJob = useByJob();
  const funnel = useFunnel();
  const gaps = useSkillGaps();
  const o = overview.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Recruiter"
        accent="dashboard"
        description="Where your hiring stands right now."
        actions={
          <Button asChild variant="lime">
            <Link href="/recruiter/jobs/new">
              <Plus aria-hidden />
              Post a job
            </Link>
          </Button>
        }
      />

      {overview.isError ? (
        <ErrorState onRetry={() => overview.refetch()} />
      ) : (
        <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overview.isPending || !o ? (
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl bg-cream-100" aria-busy="true" />
            ))
          ) : (
            <>
              <StatCard label="Active jobs" value={o.active_jobs} />
              <StatCard label="Applications" value={o.total_applications} />
              <StatCard label="Shortlisted" value={o.shortlisted} />
              <StatCard label="Pending reviews" value={o.pending_reviews} hint="Waiting for your decision" />
              <StatCard label="Upcoming interviews" value={o.upcoming_interviews} />
              <StatCard label="Shortlist rate" value={percent(o.shortlist_rate)} />
              <StatCard label="Avg. processing time" value={`${o.avg_processing_days.toFixed(1)} days`} />
            </>
          )}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <ByJobChart data={byJob.data} loading={byJob.isPending} error={byJob.isError} onRetry={() => byJob.refetch()} />
        <FunnelChart data={funnel.data} loading={funnel.isPending} error={funnel.isError} onRetry={() => funnel.refetch()} />
      </div>
      <SkillGapsChart data={gaps.data} loading={gaps.isPending} error={gaps.isError} onRetry={() => gaps.refetch()} />
    </div>
  );
}