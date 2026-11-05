"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export function useCompare(ids: number[]) {
  const valid = ids.length >= 2 && ids.length <= 4;
  return useQuery({
    queryKey: ["recruiter", "compare", ids],
    queryFn: () => api.applications.compare(ids),
    enabled: valid,
    placeholderData: keepPreviousData,
  });
}