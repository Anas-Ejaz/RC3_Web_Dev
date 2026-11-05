import { BREAKDOWN_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Assessment } from "@/types/api";

interface ScoreCardProps {
  score: number;
  label?: string;
  subtitle?: string;
  breakdown?: Assessment["breakdown"];
  variant?: "dark" | "light";
  className?: string;
}

/** Signature component: big percentage with component breakdown bars. */
export function ScoreCard({ score, label = "Match", subtitle, breakdown, variant = "light", className }: ScoreCardProps) {
  const dark = variant === "dark";
  return (
    <div
      className={cn(
        "rounded-3xl p-6 shadow-card",
        dark ? "bg-forest-800 text-cream-50" : "bg-card text-card-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm", dark ? "text-cream-50/70" : "text-muted-foreground")}>{label}</p>
          <p className="mt-1 text-6xl font-semibold leading-none tracking-tight" aria-label={`${score} percent`}>
            {Math.round(score)}
            <span className="text-3xl">%</span>
          </p>
          {subtitle && <p className={cn("mt-2 text-sm", dark ? "text-cream-50/70" : "text-muted-foreground")}>{subtitle}</p>}
        </div>
        <span className="rounded-full bg-lime px-3 py-1 text-xs font-medium text-forest-900">AI score</span>
      </div>

      {breakdown && (
        <ul className="mt-6 space-y-3">
          {(Object.keys(BREAKDOWN_LABEL) as (keyof typeof BREAKDOWN_LABEL)[]).map((k) => (
            <li key={k}>
              <div className="mb-1 flex justify-between text-xs">
                <span className={dark ? "text-cream-50/80" : "text-muted-foreground"}>
                  {BREAKDOWN_LABEL[k]} <span className="opacity-60">· {Math.round(breakdown[k].weight * 100)}%</span>
                </span>
                <span className="font-medium">{Math.round(breakdown[k].score)}%</span>
              </div>
              <div
                className={cn("h-2 overflow-hidden rounded-full", dark ? "bg-cream-50/15" : "bg-cream-300")}
                role="progressbar"
                aria-valuenow={breakdown[k].score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={BREAKDOWN_LABEL[k]}
              >
                <div className="h-full rounded-full bg-lime" style={{ width: `${breakdown[k].score}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}