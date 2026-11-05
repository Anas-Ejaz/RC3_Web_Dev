import { MessageCircleQuestion, Plus } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "@/components/landing/section-heading";
import { Button } from "@/components/ui/button";

const FAQS = [
  {
    q: "How is the match score calculated?",
    a: "Skills count for 50%, experience 25%, projects 15% and qualifications 10%. Each required and preferred skill is checked against the resume and shown with the excerpt that supports it.",
  },
  {
    q: "Does the AI decide who gets hired?",
    a: "No. Scores are recommendations only. Shortlisting, rejecting and the final decision are always manual, and each one is recorded with a reason in the audit trail.",
  },
  {
    q: 'What does "No evidence found" mean?',
    a: "We could not find proof of that skill in the resume. It does not mean the candidate lacks it: the resume may simply not mention it. It is flagged for you to check, never treated as a failing.",
  },
  {
    q: "Which resume formats are supported?",
    a: "PDF resumes. If a file cannot be read, is empty or is the wrong type, candidates see a clear message and can retry. They can also review and correct everything we extracted.",
  },
  {
    q: "How do you check for bias?",
    a: "Recruiters can run a fairness test on any application. It re-scores the resume with attributes like name, gender, age or location changed and reports whether the score moved.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="container scroll-mt-6 py-20">
      <SectionHeading chip="Common FAQs" title="Your most common" accent="questions, answered" description="How scoring, review and fairness work." />
      <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-forest-hero p-8 text-cream-50 lg:self-start">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-lime text-forest-900">
            <MessageCircleQuestion className="h-6 w-6" aria-hidden />
          </span>
          <h3 className="text-2xl font-medium">Ready to see it in action?</h3>
          <p className="text-cream-50/70">Create a free account and explore the platform with your own roles and resumes.</p>
          <Button asChild variant="lime">
            <Link href="/register">Create an account</Link>
          </Button>
        </div>

        <div className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl bg-cream-200 px-5 open:bg-card open:shadow-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest-900 text-cream-50">
                  <Plus className="h-4 w-4 transition-transform group-open:rotate-45" aria-hidden />
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}