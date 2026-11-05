"use client";

import Link from "next/link";

import { PageHeader } from "@/components/brand";
import { RecommendationCard } from "@/components/candidate/recommendation-card";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useRecommendations } from "@/hooks/use-applications";

export default function CandidateRecommendedPage() {
  const recommendations = useRecommendations();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Recommended"
        accent="for you"
        description="Roles that fit your skills, with the reasons behind each match."
      />
      {recommendations.isError ? (
        <ErrorState onRetry={() => recommendations.refetch()} />
      ) : recommendations.isPending ? (
        <div className="space-y-4">
          <CardSkeleton />
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
          {recommendations.data.map((item) => (
            <RecommendationCard key={item.job.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}