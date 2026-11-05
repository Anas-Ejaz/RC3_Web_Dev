"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { toast, toastError } from "@/lib/toast";

export const TALENT_KEY = ["recruiter", "talent"] as const;

type SearchBody = Parameters<typeof api.talent.search>[0];
type FairnessBody = Parameters<typeof api.talent.fairness>[0];

export function useTalentSearch() {
  return useMutation({
    mutationFn: (body: SearchBody) => api.talent.search(body),
    onError: (e) => toastError(e),
  });
}

export function useTalentPool(jobId: number) {
  return useQuery({
    queryKey: [...TALENT_KEY, "pool", jobId],
    queryFn: () => api.talent.pool(jobId),
    enabled: Number.isFinite(jobId) && jobId > 0,
  });
}

export function useDuplicates() {
  return useQuery({
    queryKey: [...TALENT_KEY, "duplicates"],
    queryFn: () => api.talent.duplicates(),
  });
}

export function useMergeDuplicate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.talent.merge(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: TALENT_KEY });
      toast.success("Records merged");
    },
    onError: (e) => toastError(e),
  });
}

export function useDismissDuplicate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.talent.dismiss(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: TALENT_KEY });
      toast.success("Marked as not a duplicate");
    },
    onError: (e) => toastError(e),
  });
}

export function useFairnessTest() {
  return useMutation({
    mutationFn: (body: FairnessBody) => api.talent.fairness(body),
    onError: (e) => toastError(e),
  });
}