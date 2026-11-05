import { FileText, UserCheck } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { EvidenceExcerpt } from "@/components/shared/evidence-excerpt";
import { SkillBadge } from "@/components/shared/skill-badge";
import { AI_NOTICE } from "@/lib/constants";

function UploadVisual() {
  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card" aria-hidden>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream-300">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">maya_chen_resume.pdf</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-cream-300">
            <div className="h-full w-full rounded-full bg-lime-dark" />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Parsed · 12 skills found, each with its source line</p>
    </div>
  );
}

function ScoreVisual() {
  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card" aria-hidden>
      <SkillBadge name="Django" state="confirmed" />
      <EvidenceExcerpt excerpt="Built a multi-tenant Django REST API serving 200k users." highlight={["Django"]} />
      <SkillBadge name="Docker" state="no_evidence_found" />
      <p className="text-xs text-muted-foreground">May be missing from the resume, not from the candidate.</p>
    </div>
  );
}

function ReviewVisual() {
  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card" aria-hidden>
      <p className="rounded-xl bg-cream-200 px-3 py-2 text-xs font-medium">{AI_NOTICE}</p>
      <div className="flex gap-2">
        <span className="rounded-full bg-lime px-3.5 py-1.5 text-xs font-medium text-forest-900">Shortlist</span>
        <span className="rounded-full border px-3.5 py-1.5 text-xs font-medium">Reject with reason</span>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserCheck className="h-3.5 w-3.5" /> Logged in the audit trail
      </p>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Upload a resume",
    description: "Candidates upload a PDF. We extract skills, education, experience and projects, and review them with the candidate.",
    Visual: UploadVisual,
  },
  {
    n: "02",
    title: "Get an explainable score",
    description: "Every skill is confirmed, weak or not found, with the resume excerpt beside it. No black-box number.",
    Visual: ScoreVisual,
  },
  {
    n: "03",
    title: "Human review",
    description: "Recruiters shortlist, reject or advance manually. Every change needs a reason and is recorded.",
    Visual: ReviewVisual,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container scroll-mt-6 py-20">
      <SectionHeading
        chip="How it works"
        title="A smarter way to"
        accent="hire"
        description="Three steps from resume to a decision you can defend."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map(({ n, title, description, Visual }) => (
          <article key={n} className="flex flex-col gap-6 rounded-3xl bg-cream-200 p-6">
            <Visual />
            <div>
              <p className="text-sm font-medium text-muted-foreground">{n}</p>
              <h3 className="mt-1 text-xl font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}