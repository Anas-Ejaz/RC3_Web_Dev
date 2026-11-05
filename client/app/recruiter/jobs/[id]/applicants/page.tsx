"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/brand";
import { ScoreCell } from "@/components/recruiter/score-cell";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { useJob } from "@/hooks/use-jobs";
import { useJobApplications, type ApplicantFilters } from "@/hooks/use-recruiter-applications";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_ORDER } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Application } from "@/types/api";

const MAX_COMPARE = 4;

type StatusFilter = Application["status"] | "all";

const columns: Column<Application>[] = [
  {
    key: "candidate",
    header: "Candidate",
    cell: (a) => (
      <Link
        href={`/recruiter/applications/${a.id}`}
        className="rounded font-medium text-forest-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
      >
        {a.candidate_name}
      </Link>
    ),
  },
  { key: "score", header: "Score", cell: (a) => <ScoreCell assessment={a.assessment} /> },
  { key: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
  { key: "submitted", header: "Submitted", cell: (a) => formatDate(a.submitted_at) },
];

function parseMinScore(value: string): number | undefined {
  if (value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
}

export default function ApplicantsPage() {
  const params = useParams<{ id: string }>();
  const jobId = Number(params.id);
  const router = useRouter();

  const [sort, setSort] = useState<ApplicantFilters["sort"]>("score");
  const [minScore, setMinScore] = useState("");
  const [skill, setSkill] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);

  const debouncedMin = useDebounce(minScore.trim());
  const debouncedSkill = useDebounce(skill.trim());

  const job = useJob(jobId);
  const applicants = useJobApplications(jobId, {
    sort,
    min_score: parseMinScore(debouncedMin),
    skill: debouncedSkill || undefined,
    status: status === "all" ? undefined : status,
    page,
  });

  const hasFilters = minScore !== "" || skill !== "" || status !== "all";

  function clearFilters() {
    setMinScore("");
    setSkill("");
    setStatus("all");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/recruiter/jobs">
          <ArrowLeft aria-hidden />
          All jobs
        </Link>
      </Button>
      <PageHeader title="Ranked" accent="applicants" description={job.data?.title} />

      <div className="grid gap-4 rounded-3xl bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="applicants-sort">Sort by</Label>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as ApplicantFilters["sort"]);
              setPage(1);
            }}
          >
            <SelectTrigger id="applicants-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Best match first</SelectItem>
              <SelectItem value="date">Newest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="applicants-min-score">Minimum score</Label>
          <Input
            id="applicants-min-score"
            type="number"
            min={0}
            max={100}
            placeholder="0 to 100"
            value={minScore}
            onChange={(e) => {
              setMinScore(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="applicants-skill">Skill</Label>
          <Input
            id="applicants-skill"
            placeholder="e.g. React"
            value={skill}
            onChange={(e) => {
              setSkill(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="applicants-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger id="applicants-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {APPLICATION_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {APPLICATION_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {selected.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-full bg-forest-950 px-6 py-3 text-cream-50"
        >
          <p className="text-sm">
            {selected.length} selected. Choose 2 to {MAX_COMPARE} applicants to compare.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outlineLight" size="sm" onClick={() => setSelected([])}>
              Clear selection
            </Button>
            <Button
              variant="lime"
              size="sm"
              disabled={selected.length < 2}
              onClick={() => router.push(`/recruiter/compare?ids=${selected.join(",")}`)}
            >
              Compare
            </Button>
          </div>
        </div>
      )}

      {applicants.isError ? (
        <ErrorState onRetry={() => applicants.refetch()} />
      ) : (
        <div className="space-y-4">
          {applicants.data && (
            <p className="text-sm text-forest-900/70" aria-live="polite">
              {applicants.data.total} {applicants.data.total === 1 ? "applicant" : "applicants"}
            </p>
          )}
          <DataTable
            caption="Applicants for this job, ranked by match score"
            columns={columns}
            rows={applicants.data?.items ?? []}
            getRowId={(a) => a.id}
            isLoading={applicants.isPending}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            maxSelectable={MAX_COMPARE}
            empty={
              <EmptyState
                title={hasFilters ? "No applicants match your filters" : "No applicants yet"}
                description={
                  hasFilters ? "Try loosening your filters." : "Applicants appear here as soon as candidates apply."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            }
          />
          {applicants.data && (
            <Pagination
              page={page}
              pageSize={applicants.data.page_size}
              total={applicants.data.total}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}