import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

import { SectionCard } from "@/components/candidate/section-card";
import { Progress } from "@/components/ui/progress";
import type { Completeness } from "@/lib/completeness";

export function CompletenessCard({ completeness }: { completeness: Completeness }) {
  const { percent, items } = completeness;
  return (
    <SectionCard
      title="Profile completeness"
      description={
        percent === 100
          ? "Your profile is complete."
          : "A complete profile helps us match you to the right roles."
      }
    >
      <div className="flex items-center gap-3">
        <Progress value={percent} aria-label="Profile completeness" className="h-2" />
        <span className="text-sm font-semibold tabular-nums">{percent}%</span>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-forest-600" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 text-forest-900/30" aria-hidden />
            )}
            {item.done ? (
              <span className="text-forest-900/70">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="font-medium text-forest-950 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
              >
                {item.label}
              </Link>
            )}
            <span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}