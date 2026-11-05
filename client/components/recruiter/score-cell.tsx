import { Progress } from "@/components/ui/progress";
import { effectiveScore } from "@/lib/assessment";
import type { Assessment } from "@/types/api";

export function ScoreCell({ assessment }: { assessment?: Assessment | null }) {
  const score = effectiveScore(assessment);

  if (score === null) {
    return <span className="text-sm text-forest-900/60">Not assessed yet</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <Progress value={score} aria-label={`Score ${score} out of 100`} className="h-1.5 w-20" />
      <span className="text-sm font-semibold tabular-nums">{score}</span>
      {assessment?.overridden && (
        <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs text-forest-950">Overridden</span>
      )}
    </div>
  );
}