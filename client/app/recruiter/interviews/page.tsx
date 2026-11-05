"use client";

import { useState } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/brand";
import { FeedbackDialog, RECOMMENDATION_LABEL } from "@/components/recruiter/feedback-dialog";
import { INTERVIEW_TYPE_LABEL } from "@/components/recruiter/schedule-dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInterviewers, useInterviews } from "@/hooks/use-interviews";
import { formatDateTime } from "@/lib/utils";
import type { Interview } from "@/types/api";

const columns: Column<Interview>[] = [
  { key: "when", header: "When", cell: (i) => formatDateTime(i.scheduled_at) },
  {
    key: "candidate",
    header: "Candidate",
    cell: (i) => (
      <div>
        <Link
          href={`/recruiter/applications/${i.application_id}`}
          className="rounded font-medium text-forest-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
        >
          {i.candidate_name}
        </Link>
        <p className="text-xs text-forest-900/60">{i.job_title}</p>
      </div>
    ),
  },
  { key: "interviewer", header: "Interviewer", cell: (i) => i.interviewer_name },
  { key: "type", header: "Type", cell: (i) => `${INTERVIEW_TYPE_LABEL[i.type]} · ${i.duration_minutes} min` },
  {
    key: "where",
    header: "Location",
    cell: (i) =>
      /^https?:\/\//.test(i.location_or_link) ? (
        <a
          href={i.location_or_link}
          target="_blank"
          rel="noreferrer"
          className="rounded text-forest-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
        >
          Join link
        </a>
      ) : (
        i.location_or_link
      ),
  },
  {
    key: "feedback",
    header: "Feedback",
    cell: (i) =>
      i.feedback ? (
        <span className="rounded-full bg-lime-soft px-3 py-1 text-xs font-medium text-forest-950">
          {RECOMMENDATION_LABEL[i.feedback.recommendation]}
        </span>
      ) : (
        <FeedbackDialog interview={i} />
      ),
  },
];

export default function InterviewsPage() {
  const [interviewer, setInterviewer] = useState("all");
  const interviewers = useInterviewers();
  const interviews = useInterviews({ interviewer_id: interviewer === "all" ? undefined : Number(interviewer) });

  const rows = [...(interviews.data ?? [])].sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));

  return (
    <div className="space-y-6">
      <PageHeader title="Your" accent="interviews" description="Upcoming and past interviews. Add feedback after each one." />

      <div className="max-w-xs space-y-2 rounded-3xl bg-white p-4 shadow-card">
        <Label htmlFor="iv-filter">Interviewer</Label>
        <Select value={interviewer} onValueChange={setInterviewer}>
          <SelectTrigger id="iv-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All interviewers</SelectItem>
            {(interviewers.data ?? []).map((i) => (
              <SelectItem key={i.id} value={String(i.id)}>
                {i.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {interviews.isError ? (
        <ErrorState onRetry={() => interviews.refetch()} />
      ) : (
        <DataTable
          caption="Scheduled interviews"
          columns={columns}
          rows={rows}
          getRowId={(i) => i.id}
          isLoading={interviews.isPending}
          empty={
            <EmptyState
              title="No interviews yet"
              description="Schedule one from an application's Interview tab."
            />
          }
        />
      )}
    </div>
  );
}