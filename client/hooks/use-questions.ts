"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { toast, toastError } from "@/lib/toast";
import type { QuestionGenerateInput } from "@/types/api";

export const QUESTIONS_KEY = ["recruiter", "questions"] as const;

type UpdateBody = Parameters<typeof api.questions.update>[1];

export function useQuestions(applicationId: number) {
  return useQuery({
    queryKey: [...QUESTIONS_KEY, applicationId],
    queryFn: () => api.questions.list(applicationId),
    enabled: Number.isFinite(applicationId),
  });
}

function useRefreshQuestions() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: QUESTIONS_KEY });
}

export function useGenerateQuestions() {
  const refresh = useRefreshQuestions();
  return useMutation({
    mutationFn: ({ appId, body }: { appId: number; body: QuestionGenerateInput }) =>
      api.questions.generate(appId, body),
    onSuccess: async () => {
      await refresh();
      toast.success("Interview questions generated");
    },
    onError: (e) => toastError(e),
  });
}

export function useUpdateQuestion() {
  const refresh = useRefreshQuestions();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateBody }) => api.questions.update(id, body),
    onSuccess: async () => {
      await refresh();
      toast.success("Question saved");
    },
    onError: (e) => toastError(e),
  });
}

export function useDeleteQuestion() {
  const refresh = useRefreshQuestions();
  return useMutation({
    mutationFn: (id: number) => api.questions.remove(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Question deleted");
    },
    onError: (e) => toastError(e),
  });
}

export function useRegenerateQuestion() {
  const refresh = useRefreshQuestions();
  return useMutation({
    mutationFn: (id: number) => api.questions.regenerate(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Question regenerated");
    },
    onError: (e) => toastError(e),
  });
}