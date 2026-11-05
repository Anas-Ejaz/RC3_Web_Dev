"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { APPLICATIONS_KEY } from "@/hooks/use-applications";
import { RESUME_KEY } from "@/hooks/use-candidate";
import { api, isApiError } from "@/lib/api";
import { toast, toastError } from "@/lib/toast";
import type { Job } from "@/types/api";

export const JOBS_KEY = ["jobs"] as const;

export interface JobFilters {
  q?: string;
  location?: string;
  type?: Job["type"];
  page?: number;
  page_size?: number;
}

export function useJobs(filters: JobFilters) {
  return useQuery({
    queryKey: [...JOBS_KEY, "list", filters],
    queryFn: () => api.jobs.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useJob(id: number) {
  return useQuery({
    queryKey: [...JOBS_KEY, "detail", id],
    queryFn: () => api.jobs.get(id),
    enabled: Number.isFinite(id),
  });
}

export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) => api.jobs.apply(jobId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: APPLICATIONS_KEY });
      toast.success("Application submitted");
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "ALREADY_APPLIED") {
        qc.invalidateQueries({ queryKey: APPLICATIONS_KEY });
        toast.info("You've already applied to this job.");
        return;
      }
      if (isApiError(e) && e.code === "RESUME_REQUIRED") {
        qc.invalidateQueries({ queryKey: RESUME_KEY });
        toast.error("Upload and review your resume before applying.");
        return;
      }
      toastError(e);
    },
  });
}