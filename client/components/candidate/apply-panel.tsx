import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { SectionCard } from "@/components/candidate/section-card";
import { Button } from "@/components/ui/button";
import type { MyApplication } from "@/hooks/use-applications";
import { formatDate } from "@/lib/utils";
import type { Job } from "@/types/api";

interface ApplyPanelProps {
  job: Job;
  hasResume: boolean;
  isChecking: boolean;
  checkFailed: boolean;
  application?: MyApplication;
  isApplying: boolean;
  onApply: () => void;
}

export function ApplyPanel({ job, hasResume, isChecking, checkFailed, application, isApplying, onApply }: ApplyPanelProps) {
  if (application) {
    return (
      <SectionCard title="Application">
        <p role="status" className="flex items-center gap-2 font-medium text-forest-950">
          <CheckCircle2 className="h-5 w-5 text-forest-600" aria-hidden />
          Applied
        </p>
        <p className="mt-1 text-sm text-forest-900/70">Submitted {formatDate(application.submitted_at)}.</p>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href="/candidate/applications">Track application</Link>
        </Button>
      </SectionCard>
    );
  }

  const closed = job.status === "closed";
  let note: ReactNode = null;
  if (closed) {
    note = "This job is no longer accepting applications.";
  } else if (checkFailed) {
    note = "We couldn't check your resume. Refresh the page and try again.";
  } else if (!isChecking && !hasResume) {
    note = (
      <>
        You need a parsed resume to apply.{" "}
        <Link href="/candidate/profile/resume" className="font-medium underline underline-offset-4">
          Upload your resume
        </Link>
        .
      </>
    );
  }

  const blocked = closed || isChecking || checkFailed || !hasResume;

  return (
    <SectionCard title="Apply">
      <Button
        variant="lime"
        size="lg"
        className="w-full"
        disabled={blocked || isApplying}
        aria-describedby={note ? "apply-note" : undefined}
        onClick={onApply}
      >
        {isApplying ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Applying…
          </>
        ) : (
          "Apply now"
        )}
      </Button>
      {note && (
        <p id="apply-note" className="mt-3 text-sm text-forest-900/80">
          {note}
        </p>
      )}
    </SectionCard>
  );
}