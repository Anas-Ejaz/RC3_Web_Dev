import Link from "next/link";
import { FileText } from "lucide-react";

import { SectionCard } from "@/components/candidate/section-card";
import { Button } from "@/components/ui/button";
import type { ParsedResume } from "@/types/api";

function describe(resume: ParsedResume | null): string {
  if (!resume) return "No resume uploaded yet.";
  switch (resume.parse_status) {
    case "parsed":
      return "Your resume has been read. Review it to make sure everything is accurate.";
    case "pending":
      return "We're reading your resume now.";
    default:
      return "We couldn't use your last upload. You can try again.";
  }
}

export function ResumeLinkCard({ resume }: { resume: ParsedResume | null }) {
  return (
    <SectionCard title="Resume">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-forest-600" aria-hidden />
        <p className="text-sm text-forest-900/80">{describe(resume)}</p>
      </div>
      <Button asChild variant="lime" className="mt-4 w-full">
        <Link href="/candidate/profile/resume">{resume ? "Manage resume" : "Upload resume"}</Link>
      </Button>
    </SectionCard>
  );
}