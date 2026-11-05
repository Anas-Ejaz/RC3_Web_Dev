"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { JOBS_KEY } from "@/hooks/use-jobs";
import { api } from "@/lib/api";
import { toast, toastError } from "@/lib/toast";
import type { Job, JobInput } from "@/types/api";

export interface RecruiterJobFilters {
  status?: Job["status"];
  q?: string;
  page?: number;
  page_size?: number;
}

export function useRecruiterJobs(filters: RecruiterJobFilters) {
  return useQuery({
    queryKey: [...JOBS_KEY, "recruiter", filters],
    queryFn: () => api.jobs.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JobInput) => api.jobs.create(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: JOBS_KEY });
      toast.success("Job posted");
    },
    onError: (e) => toastError(e),
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: JobInput }) => api.jobs.update(id, input),
    onSuccess: async (saved) => {
      qc.setQueryData([...JOBS_KEY, "detail", saved.id], saved);
      await qc.invalidateQueries({ queryKey: JOBS_KEY });
      toast.success("Job updated");
    },
    onError: (e) => toastError(e),
  });
}

export function useCloseJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.jobs.close(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: JOBS_KEY });
      toast.success("Job closed");
    },
    onError: (e) => toastError(e),
  });
}

export function useReopenJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.jobs.reopen(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: JOBS_KEY });
      toast.success("Job reopened");
    },
    onError: (e) => toastError(e),
  });
}

export function useExtractRequirements() {
  return useMutation({
    mutationFn: (description: string) => api.jobs.extractRequirements(description),
    onError: (e) => toastError(e),
  });
}