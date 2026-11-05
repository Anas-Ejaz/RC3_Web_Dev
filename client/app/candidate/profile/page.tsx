"use client";

import type { ReactNode } from "react";

import { CompletenessCard } from "@/components/candidate/completeness-card";
import { ProfileForm } from "@/components/candidate/profile-form";
import { ResumeLinkCard } from "@/components/candidate/resume-link-card";
import { PageHeader } from "@/components/brand";
import { CardSkeleton, ErrorState } from "@/components/shared/states";
import { useProfile, useResume } from "@/hooks/use-candidate";
import { getCompleteness } from "@/lib/completeness";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Your"
        accent="profile"
        description="Keep your details current so we can match you to the right roles."
      />
      {children}
    </div>
  );
}

export default function CandidateProfilePage() {
  const profile = useProfile();
  const resume = useResume();

  if (profile.isError || resume.isError) {
    return (
      <Shell>
        <ErrorState
          onRetry={() => {
            profile.refetch();
            resume.refetch();
          }}
        />
      </Shell>
    );
  }

  if (profile.isPending || resume.isPending) {
    return (
      <Shell>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CardSkeleton />
          </div>
          <div className="space-y-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProfileForm profile={profile.data} />
        </div>
        <div className="space-y-6">
          <CompletenessCard completeness={getCompleteness(profile.data, resume.data)} />
          <ResumeLinkCard resume={resume.data} />
        </div>
      </div>
    </Shell>
  );
}