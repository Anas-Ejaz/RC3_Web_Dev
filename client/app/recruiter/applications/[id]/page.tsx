"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/brand";
import { AiNotice } from "@/components/recruiter/ai-notice";
import { ApplicationActions } from "@/components/recruiter/application-actions";
import { AssessmentPanel } from "@/components/recruiter/assessment-panel";
import { HistoryPanel } from "@/components/recruiter/history-panel";
import { InterviewPanel } from "@/components/recruiter/interview-panel";
import { NotesPanel } from "@/components/recruiter/notes-panel";
import { ResumePanel } from "@/components/recruiter/resume-panel";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApplicationDetail } from "@/hooks/use-recruiter-applications";
import { isApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const detail = useApplicationDetail(id);

  const backHref = detail.data ? `/recruiter/jobs/${detail.data.application.job_id}/applicants` : "/recruiter/jobs";
  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link href={backHref}>
        <ArrowLeft aria-hidden />
        Applicants
      </Link>
    </Button>
  );

  if (detail.isError) {
    return (
      <div className="space-y-4">
        {back}
        {isApiError(detail.error) && detail.error.status === 404 ? (
          <EmptyState title="Application not found" description="It may have been removed." />
        ) : (
          <ErrorState onRetry={() => detail.refetch()} />
        )}
      </div>
    );
  }

  if (detail.isPending) {
    return (
      <div className="space-y-4">
        {back}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const { application, resume, assessment, notes, audit } = detail.data;

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        title={application.candidate_name}
        description={`Applied ${formatDate(application.submitted_at)}`}
        actions={<StatusBadge status={application.status} />}
      />
      <AiNotice />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Tabs defaultValue="assessment" className="min-w-0">
          <TabsList>
            <TabsTrigger value="assessment">Assessment</TabsTrigger>
            <TabsTrigger value="resume">Resume</TabsTrigger>
            <TabsTrigger value="interview">Interview</TabsTrigger>
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="assessment" className="mt-6">
            <AssessmentPanel assessment={assessment} />
          </TabsContent>
          <TabsContent value="resume" className="mt-6">
            <ResumePanel applicationId={application.id} resume={resume} />
          </TabsContent>
          <TabsContent value="interview" className="mt-6">
            <InterviewPanel application={application} />
          </TabsContent>
          <TabsContent value="notes" className="mt-6">
            <NotesPanel applicationId={application.id} notes={notes} />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <HistoryPanel audit={audit} />
          </TabsContent>
        </Tabs>
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <ApplicationActions application={application} assessment={assessment} />
        </aside>
      </div>
    </div>
  );
}