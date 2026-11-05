"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/brand";
import { ResumeReviewForm } from "@/components/candidate/resume-review-form";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useResume } from "@/hooks/use-candidate";

export default function ResumeReviewPage() {
  const resume = useResume();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Review your"
        accent="resume"
        description="Check what we found. Anything marked unverified isn't backed by your resume yet, so correct or remove it."
        actions={
          <Button asChild variant="outline">
            <Link href="/candidate/profile/resume">
              <ArrowLeft aria-hidden />
              Back to upload
            </Link>
          </Button>
        }
      />
      {resume.isError ? (
        <ErrorState onRetry={() => resume.refetch()} />
      ) : resume.isPending ? (
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : !resume.data || resume.data.parse_status !== "parsed" ? (
        <EmptyState
          title="Nothing to review yet"
          description="Upload a PDF resume and wait for us to read it. Then you can review it here."
          action={
            <Button asChild variant="lime">
              <Link href="/candidate/profile/resume">Go to resume upload</Link>
            </Button>
          }
        />
      ) : (
        <ResumeReviewForm key={resume.data.id} resume={resume.data} />
      )}
    </div>
  );
}