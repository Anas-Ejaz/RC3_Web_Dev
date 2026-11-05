"use client";

import { SectionCard } from "@/components/candidate/section-card";
import { OverrideDialog } from "@/components/recruiter/override-dialog";
import { StatusDialog } from "@/components/recruiter/status-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ScoreCard } from "@/components/shared/score-card";
import { Button } from "@/components/ui/button";
import { useReassess } from "@/hooks/use-recruiter-applications";
import { effectiveScore } from "@/lib/assessment";
import type { Application, Assessment } from "@/types/api";

interface ApplicationActionsProps {
  application: Application;
  assessment: Assessment | null | undefined;
}

export function ApplicationActions({ application, assessment }: ApplicationActionsProps) {
  const reassess = useReassess();
  const score = effectiveScore(assessment);

  return (
    <div className="space-y-6">
      {assessment && score !== null ? (
        <>
          <ScoreCard
            score={score}
            label="Match score"
            subtitle={
              assessment.overridden
                ? `Recruiter override. The AI score was ${assessment.overall_score}.`
                : "AI recommendation"
            }
            breakdown={assessment.breakdown}
            variant="dark"
          />
          {assessment.overridden && assessment.override_reason && (
            <SectionCard title="Override reason">
              <p className="text-sm text-forest-950">{assessment.override_reason}</p>
            </SectionCard>
          )}
        </>
      ) : (
        <SectionCard title="Assessment">
          <p className="text-sm text-forest-900/70">No assessment has been generated yet.</p>
        </SectionCard>
      )}

      <SectionCard title="Actions">
        <div className="space-y-2">
          <StatusDialog application={application} />
          {assessment && <OverrideDialog application={application} assessment={assessment} />}
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="w-full" disabled={reassess.isPending}>
                {reassess.isPending ? "Re-running…" : "Re-run assessment"}
              </Button>
            }
            title="Re-run the AI assessment?"
            description="The assessment is regenerated from the current resume and skills. Any score override may be replaced."
            confirmLabel="Re-run assessment"
            onConfirm={() => reassess.mutate(application.id)}
          />
        </div>
      </SectionCard>
    </div>
  );
}