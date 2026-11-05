import { SectionCard } from "@/components/candidate/section-card";
import { SkillResults } from "@/components/recruiter/skill-results";
import { EmptyState } from "@/components/shared/states";
import { timeAgo } from "@/lib/utils";
import type { Assessment } from "@/types/api";

export function AssessmentPanel({ assessment }: { assessment: Assessment | null | undefined }) {
  if (!assessment) {
    return (
      <EmptyState
        title="No assessment yet"
        description="The AI assessment appears here once the resume has been read and scored."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Why this score" description={`Generated ${timeAgo(assessment.generated_at)}`}>
        <p className="whitespace-pre-line text-sm leading-relaxed text-forest-950">{assessment.explanation}</p>
      </SectionCard>

      <SectionCard
        title="Evidence by skill"
        description="Each requirement is checked against the resume. Open an excerpt to see what the AI relied on."
      >
        <div className="space-y-6">
          <SkillResults title="Required skills" results={assessment.skill_results.filter((r) => r.required)} />
          <SkillResults title="Preferred skills" results={assessment.skill_results.filter((r) => !r.required)} />
        </div>
      </SectionCard>

      {assessment.gaps.length > 0 && (
        <SectionCard
          title="No evidence found for"
          description="The resume doesn't back these requirements. That isn't a verdict on the candidate, and it may be worth asking about."
        >
          <ul className="flex flex-wrap gap-2">
            {assessment.gaps.map((gap) => (
              <li
                key={gap}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-950"
              >
                {gap}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {assessment.learning_suggestions.length > 0 && (
        <SectionCard title="Suggested learning" description="Ways the candidate could build on these areas.">
          <ul className="list-disc space-y-1 pl-5 text-sm text-forest-950">
            {assessment.learning_suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </SectionCard>
      )}

      {assessment.unsupported_claims.length > 0 && (
        <SectionCard
          title="Claims to verify"
          description="Statements in the resume that the AI could not support with evidence."
        >
          <ul className="space-y-3">
            {assessment.unsupported_claims.map((item) => (
              <li key={item.claim} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-medium">{item.claim}</p>
                <p className="mt-1 opacity-80">{item.reason}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}