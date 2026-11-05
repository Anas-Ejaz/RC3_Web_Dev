"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ANALYTICS_KEY } from "@/hooks/use-analytics";
import { RECRUITER_APPS_KEY } from "@/hooks/use-recruiter-applications";
import { api } from "@/lib/api";
import { toast, toastError } from "@/lib/toast";
import type { InterviewFeedback, InterviewInput } from "@/types/api";

export const INTERVIEWS_KEY = ["recruiter", "interviews"] as const;
export const NOTIFICATIONS_KEY = ["recruiter", "notifications"] as const;

type ListParams = Parameters<typeof api.interviews.list>[0];
type DecisionBody = Parameters<typeof api.applications.decide>[1];

export function useInterviewers() {
  return useQuery({ queryKey: [...INTERVIEWS_KEY, "interviewers"], queryFn: () => api.interviews.interviewers() });
}

export function useInterviews(params?: ListParams) {
  return useQuery({
    queryKey: [...INTERVIEWS_KEY, "list", params ?? {}],
    queryFn: () => api.interviews.list(params),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => api.interviews.notifications(),
    refetchInterval: 30_000,
  });
}

function useRefreshAll() {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
      qc.invalidateQueries({ queryKey: RECRUITER_APPS_KEY }),
      qc.invalidateQueries({ queryKey: ANALYTICS_KEY }),
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
    ]);
  };
}

/** No onError toast: the caller must handle the 409 scheduling conflict itself. */
export function useScheduleInterview() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: InterviewInput) => api.interviews.create(input),
    onSuccess: async () => {
      await refresh();
      toast.success("Interview scheduled");
    },
  });
}

export function useSubmitFeedback() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: InterviewFeedback }) => api.interviews.feedback(id, body),
    onSuccess: async () => {
      await refresh();
      toast.success("Feedback saved");
    },
    onError: (e) => toastError(e),
  });
}

export function useDecision() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: DecisionBody }) => api.applications.decide(id, body),
    onSuccess: async () => {
      await refresh();
      toast.success("Decision recorded");
    },
    onError: (e) => toastError(e),
  });
}