"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/brand";
import { AiNotice } from "@/components/recruiter/ai-notice";
import { SectionCard } from "@/components/candidate/section-card";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { ScoreCard } from "@/components/shared/score-card";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/hooks/use-compare";
import { effectiveScore } from "@/lib/assessment";
import type { ComparisonItem, EvidenceState } from "@/types/api";

const STATE_STYLE: Record<EvidenceState, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-lime-soft text-forest-950" },
  weak_evidence: { label: "Weak evidence", className: "bg-yellow-100 text-yellow-950" },
  no_evidence_found: { label: "No evidence found", className: "bg-amber-50 text-amber-950 border border-amber-200" },
};

function StatePill({ state }: { state?: EvidenceState }) {
  if (!state) return <span className="text-xs text-forest-900/50">Not assessed</span>;
  const s = STATE_STYLE[state];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>;
}

function skillMatrix(items: ComparisonItem[]) {
  const importance = new Map<string, number>();
  items.forEach((item) =>
    item.assessment.skill_results.forEach((r) => {
      importance.set(r.skill, Math.max(importance.get(r.skill) ?? 0, r.importance));
    }),
  );
  return [...importance.entries()].sort((a, b) => b[1] - a[1]).map(([skill, imp]) => ({ skill, importance: imp }));
}

function CompareView() {
  const params = useSearchParams();
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
  const valid = ids.length >= 2 && ids.length <= 4;
  const compare = useCompare(ids);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link href="/recruiter/jobs">
        <ArrowLeft aria-hidden />
        All jobs
      </Link>
    </Button>
  );

  if (!valid) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          title="Choose 2 to 4 applicants"
          description="Select applicants on a job's ranked applicants page, then press Compare."
        />
      </div>
    );
  }
  if (compare.isError) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorState onRetry={() => compare.refetch()} />
      </div>
    );
  }
  if (compare.isPending) {
    return (
      <div className="space-y-4">
        {back}
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const items = compare.data;
  const matrix = skillMatrix(items);
  const columns = { gridTemplateColumns: `repeat(${items.length}, minmax(240px, 1fr))` };

  return (
    <div className="space-y-6">
      {back}
      <PageHeader title="Compare" accent="candidates" description="Side by side, with the evidence behind each score." />
      <AiNotice />

      <div className="overflow-x-auto">
        <div className="grid gap-4" style={columns}>
          {items.map((item) => (
            <div key={item.application_id} className="space-y-3">
              <Link
                href={`/recruiter/applications/${item.application_id}`}
                className="block rounded text-lg font-semibold text-forest-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
              >
                {item.candidate_name}
              </Link>
              <ScoreCard
                score={effectiveScore(item.assessment) ?? item.assessment.overall_score}
                label="Match score"
                subtitle={item.assessment.overridden ? "Recruiter override" : "AI recommendation"}
                breakdown={item.assessment.breakdown}
              />
            </div>
          ))}
        </div>
      </div>

      <SectionCard title="Skills" description="Evidence found for each requirement.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="sr-only">Skill evidence by candidate</caption>
            <thead>
              <tr className="border-b border-forest-900/10 text-forest-900/70">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Skill
                </th>
                {items.map((item) => (
                  <th key={item.application_id} scope="col" className="py-2 pr-4 font-medium">
                    {item.candidate_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map(({ skill, importance }) => (
                <tr key={skill} className="border-b border-forest-900/5">
                  <th scope="row" className="py-3 pr-4 font-medium text-forest-950">
                    {skill}
                    <span className="block text-xs font-normal text-forest-900/60">Importance {importance} of 5</span>
                  </th>
                  {items.map((item) => (
                    <td key={item.application_id} className="py-3 pr-4">
                      <StatePill state={item.assessment.skill_results.find((r) => r.skill === skill)?.state} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="overflow-x-auto">
        <div className="grid gap-4" style={columns}>
          {items.map((item) => (
            <SectionCard key={item.application_id} title={item.candidate_name}>
              <div className="space-y-4 text-sm text-forest-950">
                <div>
                  <h3 className="font-semibold">Key evidence</h3>
                  {item.key_evidence.length === 0 ? (
                    <p className="mt-1 text-forest-900/70">None highlighted.</p>
                  ) : (
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {item.key_evidence.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">Missing information</h3>
                  {item.missing_info.length === 0 ? (
                    <p className="mt-1 text-forest-900/70">Nothing flagged.</p>
                  ) : (
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {item.missing_info.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">Why this score</h3>
                  <p className="mt-1 whitespace-pre-line text-forest-900/80">{item.assessment.explanation}</p>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <CompareView />
    </Suspense>
  );
}