"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const APPLICATIONS_KEY = ["candidate", "applications"] as const;
export const RECOMMENDATIONS_KEY = ["candidate", "recommendations"] as const;

export type MyApplication = Awaited<ReturnType<typeof api.candidate.applications>>[number] & {
  job_title?: string | null;
};
export type Recommendation = Awaited<ReturnType<typeof api.candidate.recommendations>>[number];

export function useMyApplications() {
  return useQuery({
    queryKey: APPLICATIONS_KEY,
    queryFn: () => api.candidate.applications(),
    select: (items) => [...items].sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at)),
  });
}

export function useRecommendations() {
  return useQuery({
    queryKey: RECOMMENDATIONS_KEY,
    queryFn: () => api.candidate.recommendations(),
    select: (items) => [...items].sort((a, b) => b.match_score - a.match_score),
  });
}