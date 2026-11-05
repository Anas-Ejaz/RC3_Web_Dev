"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, MapPin } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "@/components/landing/section-heading";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { api, isApiError } from "@/lib/api";
import { JOB_TYPE_LABEL } from "@/lib/constants";
import { formatSalary, timeAgo } from "@/lib/utils";

export function FeaturedJobs() {
  const jobs = useQuery({
    queryKey: ["jobs", "featured"],
    queryFn: () => api.jobs.list({ status: "open", page_size: 5 }),
  });

  return (
    <section id="jobs" className="container scroll-mt-6 py-20">
      <SectionHeading
        chip="Featured jobs"
        title="Explore roles worth"
        accent="your move"
        description="Open positions, live from the platform. Create a free account to apply."
      />

      <div className="mx-auto mt-12 max-w-4xl">
        {jobs.isLoading && <CardSkeleton count={3} />}

        {jobs.isError && (
          <ErrorState
            message={isApiError(jobs.error) && jobs.error.status === 401 ? "Log in to browse open roles." : "Open roles could not be loaded right now."}
            onRetry={() => jobs.refetch()}
          />
        )}

        {jobs.data && jobs.data.items.length === 0 && (
          <div className="rounded-2xl bg-cream-200">
            <EmptyState title="No open roles right now" description="New positions are posted regularly. Check back soon." />
          </div>
        )}

        {jobs.data && jobs.data.items.length > 0 && (
          <>
            <ul className="space-y-3">
              {jobs.data.items.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-col gap-4 rounded-2xl bg-cream-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-forest-900 text-lime">
                      <Briefcase className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {job.department} · {timeAgo(job.created_at)}
                      </p>
                      <h3 className="text-lg font-medium">{job.title}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-cream-50 px-2.5 py-1">{JOB_TYPE_LABEL[job.type]}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-cream-50 px-2.5 py-1">
                          <MapPin className="h-3 w-3" aria-hidden />
                          {job.location}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <p className="text-sm font-medium">{formatSalary(job.salary_min, job.salary_max, job.currency)}</p>
                    <Button asChild>
                      <Link href={`/login?next=/candidate/jobs/${job.id}`}>View Job</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 text-center">
              <Button asChild variant="outline">
                <Link href="/login?next=/candidate/jobs">
                  Browse all jobs <ArrowRight />
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}