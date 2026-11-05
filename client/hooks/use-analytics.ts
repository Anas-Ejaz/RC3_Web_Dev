"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const ANALYTICS_KEY = ["recruiter", "analytics"] as const;

export const useOverview = () =>
  useQuery({ queryKey: [...ANALYTICS_KEY, "overview"], queryFn: () => api.analytics.overview() });

export const useByJob = () =>
  useQuery({ queryKey: [...ANALYTICS_KEY, "by-job"], queryFn: () => api.analytics.byJob() });

export const useFunnel = () =>
  useQuery({ queryKey: [...ANALYTICS_KEY, "funnel"], queryFn: () => api.analytics.funnel() });

export const useSkillGaps = () =>
  useQuery({ queryKey: [...ANALYTICS_KEY, "skill-gaps"], queryFn: () => api.analytics.skillGaps() });