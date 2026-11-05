"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { toast, toastError } from "@/lib/toast";
import type { Application } from "@/types/api";

export const RECRUITER_APPS_KEY = ["recruiter", "applications"] as const;

type StatusBody = Parameters<typeof api.applications.setStatus>[1];
type OverrideBody = Parameters<typeof api.applications.override>[1];
type SkillsBody = Parameters<typeof api.applications.updateSkills>[1];

export interface ApplicantFilters {
  sort: "score" | "date";
  min_score?: number;
  skill?: string;
  status?: Application["status"];
  page: number;
}

export function useJobApplications(jobId: number, filters: ApplicantFilters) {
  return useQuery({
    queryKey: [...RECRUITER_APPS_KEY, "list", jobId, filters],
    queryFn: () => api.jobs.applications(jobId, filters),
    placeholderData: keepPreviousData,
    enabled: Number.isFinite(jobId),
  });
}

export function useApplicationDetail(id: number) {
  return useQuery({
    queryKey: [...RECRUITER_APPS_KEY, "detail", id],
    queryFn: () => api.applications.get(id),
    enabled: Number.isFinite(id),
  });
}

function useRefreshApplications() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: RECRUITER_APPS_KEY });
}

export function useSetStatus() {
  const refresh = useRefreshApplications();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: StatusBody }) => api.applications.setStatus(id, body),
    onSuccess: async () => {
      await refresh();
      toast.success("Status updated");
    },
    onError: (e) => toastError(e),
  });
}

export function useAddNote() {
  const refresh = useRefreshApplications();
  return useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) => api.applications.addNote(id, text),
    onSuccess: async () => {
      await refresh();
      toast.success("Note added");
    },
    onError: (e) => toastError(e),
  });
}

export function useUpdateSkills() {
  const refresh = useRefreshApplications();
  return useMutation({
    mutationFn: ({ id, skills }: { id: number; skills: SkillsBody }) => api.applications.updateSkills(id, skills),
    onSuccess: async () => {
      await refresh();
      toast.success("Skills saved and score refreshed");
    },
    onError: (e) => toastError(e),
  });
}

export function useOverrideScore() {
  const refresh = useRefreshApplications();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: OverrideBody }) => api.applications.override(id, body),
    onSuccess: async () => {
      await refresh();
      toast.success("Score overridden");
    },
    onError: (e) => toastError(e),
  });
}

export function useReassess() {
  const refresh = useRefreshApplications();
  return useMutation({
    mutationFn: (id: number) => api.applications.reassess(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Assessment refreshed");
    },
    onError: (e) => toastError(e),
  });
}