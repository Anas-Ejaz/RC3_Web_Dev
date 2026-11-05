"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RECOMMENDATIONS_KEY } from "@/hooks/use-applications";
import { api, isApiError, uploadResume } from "@/lib/api";
import { toast, toastError } from "@/lib/toast";
import type { ProfileValues } from "@/lib/validators";
import type { ParsedResume } from "@/types/api";

export const PROFILE_KEY = ["candidate", "profile"] as const;
export const RESUME_KEY = ["candidate", "resume"] as const;

type ResumeCorrectionsInput = Parameters<typeof api.candidate.saveResumeCorrections>[0];

export function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: () => api.candidate.getProfile() });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ProfileValues) => api.candidate.updateProfile(values),
    onSuccess: (saved) => {
      qc.setQueryData(PROFILE_KEY, saved);
      toast.success("Profile saved");
    },
    onError: (e) => toastError(e),
  });
}

export function useResume() {
  return useQuery<ParsedResume | null>({
    queryKey: RESUME_KEY,
    queryFn: async () => {
      try {
        return await api.candidate.getResume();
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null;
        throw e;
      }
    },
    refetchInterval: (query) => (query.state.data?.parse_status === "pending" ? 2000 : false),
  });
}

export function useUploadResume() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);
  const mutation = useMutation({
    mutationFn: (file: File) => {
      setProgress(0);
      return uploadResume(file, setProgress);
    },
    onSuccess: (resume) => {
      qc.setQueryData(RESUME_KEY, resume);
      qc.invalidateQueries({ queryKey: RECOMMENDATIONS_KEY });
    },
  });
  return { ...mutation, progress };
}

export function useSaveResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ResumeCorrectionsInput) => api.candidate.saveResumeCorrections(values),
    onSuccess: (saved) => {
      qc.setQueryData(RESUME_KEY, saved);
      qc.invalidateQueries({ queryKey: RECOMMENDATIONS_KEY });
      toast.success("Resume corrections saved");
    },
  });
}