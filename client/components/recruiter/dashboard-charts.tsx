"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SectionCard } from "@/components/candidate/section-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { APPLICATION_STATUS_LABEL } from "@/lib/constants";
import type { Application, ByJobStat, FunnelStage, SkillGap } from "@/types/api";

// Hex values mirror the forest and lime tokens. Adjust if your Tailwind tokens differ.
const FOREST = "#14532d";
const LIME = "#a3e635";
const AMBER = "#d97706";

interface ChartShellProps {
  title: string;
  description: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  empty: boolean;
  emptyText: string;
  summary: string;
  children: ReactNode;
}

function ChartShell({ title, description, loading, error, onRetry, empty, emptyText, summary, children }: ChartShellProps) {
  return (
    <SectionCard title={title} description={description}>
      {error ? (
        <ErrorState onRetry={onRetry} />
      ) : loading ? (
        <div className="h-72 animate-pulse rounded-2xl bg-cream-100" aria-busy="true" />
      ) : empty ? (
        <EmptyState title="No data yet" description={emptyText} />
      ) : (
        <div role="img" aria-label={summary} className="h-72 w-full">
          {children}
        </div>
      )}
    </SectionCard>
  );
}

interface ChartProps<T> {
  data: T[] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

export function ByJobChart({ data, loading, error, onRetry }: ChartProps<ByJobStat>) {
  const rows = data ?? [];
  return (
    <ChartShell
      title="Applications by job"
      description="Applications received and how many were shortlisted."
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={rows.length === 0}
      emptyText="Post a job and applications will show up here."
      summary={`Bar chart of applications and shortlisted candidates for ${rows.length} jobs`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="applications" name="Applications" fill={FOREST} radius={[6, 6, 0, 0]} />
          <Bar dataKey="shortlisted" name="Shortlisted" fill={LIME} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function FunnelChart({ data, loading, error, onRetry }: ChartProps<FunnelStage>) {
  const rows = (data ?? []).map((s) => ({
    ...s,
    label: APPLICATION_STATUS_LABEL[s.stage as Application["status"]] ?? s.stage,
  }));
  return (
    <ChartShell
      title="Hiring funnel"
      description="How many applications reached each stage."
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={rows.length === 0}
      emptyText="The funnel fills in as candidates apply and move through review."
      summary={`Funnel chart with ${rows.length} stages`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" name="Applications" fill={FOREST} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function SkillGapsChart({ data, loading, error, onRetry }: ChartProps<SkillGap>) {
  const rows = (data ?? []).slice(0, 8);
  return (
    <ChartShell
      title="Common skill gaps"
      description="Skills most often without evidence in resumes. This reflects resumes, not people."
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={rows.length === 0}
      emptyText="Gaps appear once applications have been assessed."
      summary={`Bar chart of the ${rows.length} skills most often missing evidence`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} unit="%" />
          <YAxis type="category" dataKey="skill" width={110} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => `${Math.round(Number(v))}% of applicants`} />
          <Bar dataKey="percentage" name="Missing evidence" fill={AMBER} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}