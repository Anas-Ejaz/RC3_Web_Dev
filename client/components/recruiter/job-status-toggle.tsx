"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useCloseJob, useReopenJob } from "@/hooks/use-recruiter-jobs";
import type { Job } from "@/types/api";

interface JobStatusToggleProps {
  job: Job;
  variant?: "ghost" | "outline";
}

export function JobStatusToggle({ job, variant = "ghost" }: JobStatusToggleProps) {
  const close = useCloseJob();
  const reopen = useReopenJob();

  if (job.status === "open") {
    return (
      <ConfirmDialog
        trigger={
          <Button variant={variant} size="sm" disabled={close.isPending} aria-label={`Close ${job.title}`}>
            Close job
          </Button>
        }
        title={`Close "${job.title}"?`}
        description="Candidates will no longer be able to apply. You can reopen it at any time."
        confirmLabel="Close job"
        destructive
        onConfirm={() => close.mutate(job.id)}
      />
    );
  }

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={reopen.isPending}
      aria-label={`Reopen ${job.title}`}
      onClick={() => reopen.mutate(job.id)}
    >
      Reopen job
    </Button>
  );
}