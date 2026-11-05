"use client";

import Link from "next/link";

import { PageHeader } from "@/components/brand";
import { CompletenessCard } from "@/components/candidate/completeness-card";
import { RecommendationCard } from "@/components/candidate/recommendation-card";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useMyApplications, useRecommendations } from "@/hooks/use-applications";
import { useMe } from "@/hooks/use-auth";
import { useProfile, useResume } from "@/hooks/use-candidate";
import { summarizeApplications } from "@/lib/candidate-status";
import { getCompleteness } from "@/lib/completeness";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-card">
      <p className="text-3xl font-semibold tabular-nums text-forest-950">{value}</p>
      <p className="mt-1 text-sm text-forest-900/70">{label}</p>
    </div>
  );
}

export default function CandidateDashboardPage() {
  const me = useMe();
  const profile = useProfile();
  const resume = useResume();
  const applications = useMyApplications();
  const recommendations = useRecommendations();

  const firstName = me.data?.full_name.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome back,"
        accent={firstName}
        description="Here's where you stand and the roles that fit you best."
        actions={
          <Button asChild variant="lime">
            <Link href="/candidate/jobs">Browse jobs</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section aria-labelledby="applications-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="applications-heading" className="text-lg font-semibold text-forest-950">
                Your applications
              </h2>
              <Link href="/candidate/applications" className="text-sm font-medium underline-offset-4 hover:underline">
                View all
              </Link>
            </div>
            {applications.isError ? (
              <ErrorState onRetry={() => applications.refetch()} />
            ) : applications.isPending ? (
              <CardSkeleton />
            ) : (
              <SummaryTiles applications={applications.data} />
            )}
          </section>

          <section aria-labelledby="recommended-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="recommended-heading" className="text-lg font-semibold text-forest-950">
                Recommended for you
              </h2>
              <Link href="/candidate/recommended" className="text-sm font-medium underline-offset-4 hover:underline">
                See all
              </Link>
            </div>
            {recommendations.isError ? (
              <ErrorState onRetry={() => recommendations.refetch()} />
            ) : recommendations.isPending ? (
              <div className="space-y-4">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : recommendations.data.length === 0 ? (
              <EmptyState
                title="No recommendations yet"
                description="Upload and review your resume and we'll suggest roles that fit."
                action={
                  <Button asChild variant="lime">
                    <Link href="/candidate/profile/resume">Upload resume</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                {recommendations.data.slice(0, 3).map((item) => (
                  <RecommendationCard key={item.job.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div>
          {profile.isError || resume.isError ? (
            <ErrorState
              onRetry={() => {
                profile.refetch();
                resume.refetch();
              }}
            />
          ) : profile.isPending || resume.isPending ? (
            <CardSkeleton />
          ) : (
            <CompletenessCard completeness={getCompleteness(profile.data, resume.data)} />
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTiles({ applications }: { applications: Parameters<typeof summarizeApplications>[0] }) {
  const summary = summarizeApplications(applications);
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatTile label="Total applications" value={summary.total} />
      <StatTile label="In review" value={summary.inReview} />
      <StatTile label="Shortlisted or interviewing" value={summary.shortlisted} />
      <StatTile label="Decisions made" value={summary.decided} />
    </div>
  );
}