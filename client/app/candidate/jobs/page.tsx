"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/brand";
import { JobCard } from "@/components/candidate/job-card";
import { Pagination } from "@/components/shared/pagination";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { useJobs } from "@/hooks/use-jobs";
import { JOB_TYPE_LABEL } from "@/lib/constants";
import type { Job } from "@/types/api";

const PAGE_SIZE = 10;

type TypeFilter = Job["type"] | "all";

export default function CandidateJobsPage() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);

  const q = useDebounce(search.trim());
  const loc = useDebounce(location.trim());

  const jobs = useJobs({
    q: q || undefined,
    location: loc || undefined,
    type: type === "all" ? undefined : type,
    page,
    page_size: PAGE_SIZE,
  });

  const hasFilters = search !== "" || location !== "" || type !== "all";

  function clearFilters() {
    setSearch("");
    setLocation("");
    setType("all");
    setPage(1);
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Find your next" accent="role" description="Search open positions and apply with your resume." />

      <div className="grid gap-4 rounded-3xl bg-white p-4 shadow-card sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="job-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-900/50" aria-hidden />
            <Input
              id="job-search"
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
          <Label htmlFor="job-location">Location</Label>
          <Input
            id="job-location"
            placeholder="Any location"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-type">Job type</Label>
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value as TypeFilter);
              setPage(1);
            }}
          >
            <SelectTrigger id="job-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(JOB_TYPE_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
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

      {jobs.isError ? (
        <ErrorState onRetry={() => jobs.refetch()} />
      ) : jobs.isPending ? (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : jobs.data.items.length === 0 ? (
        <EmptyState
          title="No jobs match your search"
          description="Try different keywords or clear your filters."
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-forest-900/70" aria-live="polite">
            {jobs.data.total} {jobs.data.total === 1 ? "job" : "jobs"} found
          </p>
          <div className={jobs.isPlaceholderData ? "space-y-4 opacity-60 transition-opacity" : "space-y-4"}>
            {jobs.data.items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={jobs.data.total}
            onPageChange={(next) => {
              setPage(next);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}
    </div>
  );
}