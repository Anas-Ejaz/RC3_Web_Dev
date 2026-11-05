import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/hooks/use-applications";

function matchPercent(score: number): number {
  const percent = score <= 1 ? score * 100 : score;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function RecommendationCard({ item }: { item: Recommendation }) {
  const { job } = item;
  return (
    <article className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-card sm:flex-row">
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-forest-950 text-cream-50">
        <span className="text-2xl font-semibold tabular-nums">{matchPercent(item.match_score)}%</span>
        <span className="text-[10px] uppercase tracking-wide text-cream-50/70">match</span>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-forest-950">
            <Link
              href={`/candidate/jobs/${job.id}`}
              className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
            >
              {job.title}
            </Link>
          </h2>
          <p className="text-sm text-forest-900/70">
            {job.department} · {job.location}
          </p>
        </div>
        {item.matched_skills.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Matched skills">
            {item.matched_skills.map((skill) => (
              <li key={skill} className="rounded-full bg-lime-soft px-3 py-1 text-xs font-medium text-forest-950">
                {skill}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-forest-900/80">{item.reason}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href={`/candidate/jobs/${job.id}`}>View job</Link>
      </Button>
    </article>
  );
}