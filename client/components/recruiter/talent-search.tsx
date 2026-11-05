"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { SectionCard } from "@/components/candidate/section-card";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecruiterJobs } from "@/hooks/use-recruiter-jobs";
import { useTalentSearch } from "@/hooks/use-talent";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${clean.map(escapeRegExp).join("|")})`, "gi");
  const lowered = clean.map((t) => t.toLowerCase());
  return (
    <>
      {text.split(pattern).map((part, i) =>
        lowered.includes(part.toLowerCase()) ? (
          <mark key={i} className="rounded bg-lime-200 px-0.5 text-forest-950">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function TalentSearch() {
  const [query, setQuery] = useState("");
  const [jobId, setJobId] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const jobs = useRecruiterJobs({ page: 1, page_size: 100 });
  const search = useTalentSearch();

  function run(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setError("Type at least 3 characters, for example “Python developers with REST API experience”.");
      return;
    }
    setError(null);
    search.mutate({ query: q, job_id: jobId === "all" ? undefined : Number(jobId), limit: 10 });
  }

  const results = search.data;

  return (
    <SectionCard
      title="Search the talent pool"
      description="Describe who you are looking for in plain language. Matches show the resume text they came from."
    >
      <form onSubmit={run} noValidate className="grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="talent-query">Search</Label>
          <Input
            id="talent-query"
            value={query}
            placeholder="Python developers with REST API experience"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "talent-query-error" : undefined}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="talent-job">Limit to job</Label>
          <Select value={jobId} onValueChange={setJobId}>
            <SelectTrigger id="talent-job">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {(jobs.data?.items ?? []).map((j) => (
                <SelectItem key={j.id} value={String(j.id)}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="lime" disabled={search.isPending}>
          <Search aria-hidden />
          {search.isPending ? "Searching…" : "Search"}
        </Button>
      </form>
      {error && (
        <p id="talent-query-error" role="alert" className="mt-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      <div className="mt-6" aria-live="polite">
        {results && results.length === 0 && (
          <EmptyState title="No matches" description="Try different words or remove the job filter." />
        )}
        {results && results.length > 0 && (
          <ul className="space-y-3">
            {results.map((r) => (
              <li key={r.candidate_id} className="rounded-2xl border border-forest-900/10 bg-cream-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-forest-950">{r.name}</h3>
                  <span className="rounded-full bg-forest-950 px-3 py-1 text-xs font-semibold tabular-nums text-cream-50">
                    {Math.round(r.score <= 1 ? r.score * 100 : r.score)}% match
                  </span>
                </div>
                {r.matched_terms.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label="Matched terms">
                    {r.matched_terms.map((t) => (
                      <li key={t} className="rounded-full bg-lime-soft px-2.5 py-0.5 text-xs text-forest-950">
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="mt-3 space-y-2">
                  {r.evidence_excerpts.map((ex, i) => (
                    <li key={i} className="rounded-xl border-l-4 border-forest-700/40 bg-cream-100 px-4 py-2 text-sm text-forest-950">
                      <Highlighted text={ex} terms={r.matched_terms} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}