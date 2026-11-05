import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, Loader2, RotateCcw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParsedResume } from "@/types/api";

const TONE = {
  neutral: "bg-cream-100 text-forest-950",
  warn: "border border-amber-200 bg-amber-50 text-amber-950",
  success: "bg-lime-soft text-forest-950",
} as const;

interface PanelProps {
  tone: keyof typeof TONE;
  icon: LucideIcon;
  title: string;
  spin?: boolean;
  action?: ReactNode;
  children: ReactNode;
}

function Panel({ tone, icon: Icon, title, spin, action, children }: PanelProps) {
  return (
    <div role="status" aria-live="polite" className={cn("rounded-3xl p-6", TONE[tone])}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", spin && "animate-spin")} aria-hidden />
        <div className="space-y-1">
          <h2 className="font-semibold">{title}</h2>
          <div className="text-sm opacity-80">{children}</div>
        </div>
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ResumeStatusProps {
  resume: ParsedResume | null;
  uploadError: string | null;
  onRetry: () => void;
}

export function ResumeStatus({ resume, uploadError, onRetry }: ResumeStatusProps) {
  const retry = (
    <Button type="button" variant="outline" onClick={onRetry}>
      <RotateCcw aria-hidden />
      Retry
    </Button>
  );

  if (uploadError) {
    return (
      <Panel tone="warn" icon={AlertTriangle} title="Your upload didn't finish" action={retry}>
        <p>{uploadError}</p>
      </Panel>
    );
  }

  if (!resume) {
    return (
      <Panel tone="neutral" icon={FileText} title="No resume yet">
        <p>Upload a PDF resume. We'll read it, then you can check what we found before you apply.</p>
      </Panel>
    );
  }

  switch (resume.parse_status) {
    case "pending":
      return (
        <Panel tone="neutral" icon={Loader2} spin title="Reading your resume">
          <p>This usually takes a few seconds. This page updates automatically.</p>
        </Panel>
      );
    case "parsed":
      return (
        <Panel
          tone="success"
          icon={CheckCircle2}
          title="Your resume has been read"
          action={
            <Button asChild variant="default">
              <Link href="/candidate/profile/resume/review">Review what we found</Link>
            </Button>
          }
        >
          <p>
            We found {resume.skills.length} skills, {resume.experience.length} roles and{" "}
            {resume.education.length} education entries. Please check them before you apply.
          </p>
        </Panel>
      );
    case "failed":
      return (
        <Panel tone="warn" icon={AlertTriangle} title="We couldn't read this file" action={retry}>
          <p>Something went wrong while reading your resume. Please try uploading it again.</p>
          {resume.error_message && <p className="mt-1">{resume.error_message}</p>}
        </Panel>
      );
    case "empty":
      return (
        <Panel tone="warn" icon={AlertTriangle} title="We couldn't find any text" action={retry}>
          <p>The PDF looks empty or may be a scan of images. Upload a PDF that contains selectable text.</p>
        </Panel>
      );
    case "unsupported":
      return (
        <Panel tone="warn" icon={AlertTriangle} title="That file type isn't supported" action={retry}>
          <p>Please upload your resume as a PDF.</p>
        </Panel>
      );
  }
}