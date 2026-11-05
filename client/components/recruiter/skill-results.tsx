import { EvidenceExcerpt } from "@/components/shared/evidence-excerpt";
import { SkillBadge } from "@/components/shared/skill-badge";
import type { SkillResult } from "@/types/api";

interface SkillResultsProps {
  title: string;
  results: SkillResult[];
}

export function SkillResults({ title, results }: SkillResultsProps) {
  if (results.length === 0) return null;
  const sorted = [...results].sort((a, b) => b.importance - a.importance);

  return (
    <div>
      <h3 className="text-sm font-semibold text-forest-950">{title}</h3>
      <ul className="mt-3 space-y-3">
        {sorted.map((result) => (
          <li key={result.skill} className="rounded-2xl border border-forest-900/10 bg-cream-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SkillBadge name={result.skill} state={result.state} showLabel />
              <p className="text-xs text-forest-900/60">
                Importance {result.importance} of 5
                {result.state !== "no_evidence_found" && ` · Match strength ${Math.round(result.similarity * 100)}%`}
              </p>
            </div>
            {result.evidence_excerpt ? (
              <div className="mt-3">
                <EvidenceExcerpt excerpt={result.evidence_excerpt} highlight={result.skill} collapsible />
              </div>
            ) : (
              <p className="mt-3 text-sm text-forest-900/70">No supporting text was found in the resume.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}