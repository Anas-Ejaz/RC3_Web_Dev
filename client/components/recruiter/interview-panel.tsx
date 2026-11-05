"use client";

import { SectionCard } from "@/components/candidate/section-card";
import { DecisionDialog } from "@/components/recruiter/decision-dialog";
import { FeedbackDialog, RECOMMENDATION_LABEL } from "@/components/recruiter/feedback-dialog";
import { QuestionsPanel } from "@/components/recruiter/questions-panel";
import { INTERVIEW_TYPE_LABEL, ScheduleDialog } from "@/components/recruiter/schedule-dialog";
import { ErrorState } from "@/components/shared/states";
import { useInterviews } from "@/hooks/use-interviews";
import { formatDateTime } from "@/lib/utils";
import type { Application } from "@/types/api";

export function InterviewPanel({ application }: { application: Application }) {
  const interviews = useInterviews();
  const mine = (interviews.data ?? [])
    .filter((i) => i.application_id === application.id)
    .sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));

  return (
    <div className="space-y-6">
      <SectionCard
        title="Interviews"
        description="Schedule, collect feedback, then record your final decision."
        action={<ScheduleDialog application={application} />}
      >
        {interviews.isError ? (
          <ErrorState onRetry={() => interviews.refetch()} />
        ) : mine.length === 0 ? (
          <p className="text-sm text-forest-900/70">No interviews scheduled yet.</p>
        ) : (
          <ul className="space-y-3">
            {mine.map((i) => (
              <li key={i.id} className="rounded-2xl border border-forest-900/10 bg-cream-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-forest-950">{formatDateTime(i.scheduled_at)}</p>
                    <p className="text-xs text-forest-900/70">
                      {INTERVIEW_TYPE_LABEL[i.type]} · {i.duration_minutes} min · {i.interviewer_name}
                    </p>
                    <p className="text-xs text-forest-900/70">{i.location_or_link}</p>
                  </div>
                  {i.feedback ? (
                    <span className="rounded-full bg-lime-soft px-3 py-1 text-xs font-medium text-forest-950">
                      Feedback: {RECOMMENDATION_LABEL[i.feedback.recommendation]}
                    </span>
                  ) : (
                    <FeedbackDialog interview={i} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end border-t border-forest-900/10 pt-4">
          <DecisionDialog application={application} />
        </div>
      </SectionCard>

      <QuestionsPanel applicationId={application.id} />
    </div>
  );
}