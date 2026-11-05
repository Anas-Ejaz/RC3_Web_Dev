"use client";

import { useState } from "react";

import { SectionCard } from "@/components/candidate/section-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecruiterJobs } from "@/hooks/use-recruiter-jobs";
import { useTalentPool } from "@/hooks/use-talent";
import { formatDate } from "@/lib/utils";
import type { TalentPoolEntry } from "@/types/api";

const columns: Column<TalentPoolEntry>[] = [
  { key: "name", header: "Candidate", cell: (p) => <span className="font-medium text-forest-950">{p.name}</span> },
  { key: "job", header: "Last reviewed for", cell: (p) => p.last_job_title },
  {
    key: "score",
    header: "Score",
    cell: (p) => <span className="tabular-nums">{Math.round(p.last_score)}</span>,
  },
  { key: "reviewed", header: "Reviewed", cell: (p) => formatDate(p.reviewed_at) },
  { key: "retention", header: "Kept until", cell: (p) => formatDate(p.retention_expires_at) },
  {
    key: "permission",
    header: "Contact",
    cell: (p) =>
      p.contact_permission ? (
        <span className="rounded-full bg-lime-soft px-2.5 py-0.5 text-xs font-medium text-forest-950">Permission given</span>
      ) : (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-950">
          Do not contact
        </span>
      ),
  },
];

export function TalentPool() {
  const [jobId, setJobId] = useState("");
  const jobs = useRecruiterJobs({ page: 1, page_size: 100 });
  const pool = useTalentPool(jobId === "" ? NaN : Number(jobId));

  return (
    <SectionCard
      title="Talent pool"
      description="Previously reviewed applicants who could suit this job. Only contact people who gave permission."
    >
      <div className="max-w-sm space-y-2">
        <Label htmlFor="pool-job">Job</Label>
        <Select value={jobId} onValueChange={setJobId}>
          <SelectTrigger id="pool-job">
            <SelectValue placeholder="Choose a job" />
          </SelectTrigger>
          <SelectContent>
            {(jobs.data?.items ?? []).map((j) => (
              <SelectItem key={j.id} value={String(j.id)}>
                {j.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        {jobId === "" ? (
          <p className="text-sm text-forest-900/70">Choose a job to see relevant past applicants.</p>
        ) : pool.isError ? (
          <ErrorState onRetry={() => pool.refetch()} />
        ) : (
          <DataTable
            caption="Previously reviewed applicants relevant to this job"
            columns={columns}
            rows={pool.data ?? []}
            getRowId={(p) => p.candidate_id}
            isLoading={pool.isPending}
            empty={<EmptyState title="No one in the pool yet" description="Reviewed applicants for similar jobs appear here." />}
          />
        )}
      </div>
    </SectionCard>
  );
}