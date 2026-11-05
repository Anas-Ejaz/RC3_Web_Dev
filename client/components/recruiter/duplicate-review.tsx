"use client";

import { SectionCard } from "@/components/candidate/section-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useDismissDuplicate, useDuplicates, useMergeDuplicate } from "@/hooks/use-talent";
import type { DuplicateCandidate, DuplicatePair } from "@/types/api";

function Side({ label, c }: { label: string; c: DuplicateCandidate }) {
  return (
    <div className="rounded-2xl border border-forest-900/10 bg-cream-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-forest-900/60">{label}</p>
      <p className="mt-1 font-medium text-forest-950">{c.name}</p>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-forest-900/60">Email</dt>
          <dd className="break-all text-forest-950">{c.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-forest-900/60">Phone</dt>
          <dd className="text-forest-950">{c.phone || "Not provided"}</dd>
        </div>
      </dl>
      {c.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`Skills for ${c.name}`}>
          {c.skills.map((s) => (
            <li key={s} className="rounded-full bg-cream-200 px-2 py-0.5 text-xs text-forest-950">
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PairCard({ pair }: { pair: DuplicatePair }) {
  const merge = useMergeDuplicate();
  const dismiss = useDismissDuplicate();
  const busy = merge.isPending || dismiss.isPending;
  const pct = Math.round(pair.similarity <= 1 ? pair.similarity * 100 : pair.similarity);

  return (
    <li className="rounded-3xl bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-forest-950">
          {pair.candidate_a.name} and {pair.candidate_b.name}
        </h3>
        <span className="rounded-full bg-forest-950 px-3 py-1 text-xs font-semibold tabular-nums text-cream-50">
          {pct}% similar
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Side label="Record A" c={pair.candidate_a} />
        <Side label="Record B" c={pair.candidate_b} />
      </div>
      {pair.reasons.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-forest-950">Why these may be the same person</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-forest-900/80">
            {pair.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => dismiss.mutate(pair.id)}>
          {dismiss.isPending ? "Saving…" : "Not a duplicate"}
        </Button>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="lime" disabled={busy}>
              {merge.isPending ? "Merging…" : "Confirm merge"}
            </Button>
          }
          title="Merge these two records?"
          description="They will be combined into one candidate. This is your decision, not the AI's, and it can't be undone here."
          confirmLabel="Confirm merge"
          destructive
          onConfirm={() => merge.mutate(pair.id)}
        />
      </div>
    </li>
  );
}

export function DuplicateReview() {
  const duplicates = useDuplicates();

  return (
    <SectionCard
      title="Possible duplicates"
      description="The system only suggests matches. Nothing is merged until you confirm."
    >
      {duplicates.isError ? (
        <ErrorState onRetry={() => duplicates.refetch()} />
      ) : duplicates.isPending ? (
        <div className="h-40 animate-pulse rounded-2xl bg-cream-100" aria-busy="true" />
      ) : duplicates.data.length === 0 ? (
        <EmptyState title="No duplicates found" description="Suggested matches will show up here for review." />
      ) : (
        <ul className="space-y-4">
          {duplicates.data.map((p) => (
            <PairCard key={p.id} pair={p} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}