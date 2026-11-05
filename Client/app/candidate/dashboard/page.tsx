"use client";

import { PageHeader } from "@/components/brand";
import { EmptyState } from "@/components/shared/states";
import { useMe } from "@/hooks/use-auth";

export default function CandidateDashboardPage() {
  const { data: user } = useMe();
  return (
    <>
      <PageHeader title="Welcome back," accent={user?.full_name.split(" ")[0]} description="Your profile, applications and recommended jobs will appear here." />
      <div className="rounded-3xl border bg-card shadow-card">
        <EmptyState title="Dashboard coming soon" description="Profile completeness, application summary and recommendations arrive in later phases." />
      </div>
    </>
  );
}