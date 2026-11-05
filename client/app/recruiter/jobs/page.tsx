"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/brand";
import { JobRowActions } from "@/components/recruiter/job-row-actions";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { useRecruiterJobs } from "@/hooks/use-recruiter-jobs";
import { JOB_TYPE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Job } from "@/types/api";

const PAGE_SIZE = 10;

type StatusFilter = Job["status"] | "all";

const columns: Column<Job>[] = [
  {
    key: "title",
    header: "Job",
    cell: (job) => (
      <div>
        <Link
          href={`/recruiter/jobs/${job.id}/applicants`}
          className="rounded font-medium text-forest-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
        >
          {job.title}
        </Link>
        <p className="text-xs text-forest-900/60">
          {job.department} · {job.location}
        </p>
      </div>
    ),
  },
  { key: "type", header: "Type", cell: (job) => JOB_TYPE_LABEL[job.type] },
  { key: "status", header: "Status", cell: (job) => <StatusBadge status={job.status} /> },
  { key: "applicants", header: "Applicants", cell: (job) => job.applicant_count },
  { key: "created", header: "Posted", cell: (job) => formatDate(job.created_at) },
  { key: "actions", header: "Actions", cell: (job) => <JobRowActions job={job} /> },
];

export default function RecruiterJobsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const q = useDebounce(search.trim());
  const jobs = useRecruiterJobs({
    q: q || undefined,
    status: status === "all" ? undefined : status,
    page,
    page_size: PAGE_SIZE,
  });

  const hasFilters = search !== "" || status !== "all";

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setPage(1);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Your"
        accent="jobs"
        description="Post roles, review applicants and close positions when they are filled."
        actions={
          <Button asChild variant="lime">
            <Link href="/recruiter/jobs/new">
              <Plus aria-hidden />
              Post a job
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 rounded-3xl bg-white p-4 shadow-card sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="jobs-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-900/50"
              aria-hidden
            />
            <Input
              id="jobs-search"
              type="search"
              className="pl-9"
              placeholder="Job title or keyword"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobs-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger id="jobs-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {jobs.isError ? (
        <ErrorState onRetry={() => jobs.refetch()} />
      ) : (
        <div className="space-y-4">
          <DataTable
            caption="Your job postings"
            columns={columns}
            rows={jobs.data?.items ?? []}
            getRowId={(job) => job.id}
            isLoading={jobs.isPending}
            empty={
              <EmptyState
                title={hasFilters ? "No jobs match your filters" : "You haven't posted a job yet"}
                description={
                  hasFilters ? "Try different keywords or clear your filters." : "Post your first role to start receiving applicants."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button asChild variant="lime">
                      <Link href="/recruiter/jobs/new">Post a job</Link>
                    </Button>
                  )
                }
              />
            }
          />
          {jobs.data && (
            <Pagination
              page={page}
              pageSize={jobs.data.page_size}
              total={jobs.data.total}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}