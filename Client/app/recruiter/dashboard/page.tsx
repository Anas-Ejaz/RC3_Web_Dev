"use client";

import { PageHeader } from "@/components/brand";
import { EmptyState } from "@/components/shared/states";
import { useMe } from "@/hooks/use-auth";

export default function RecruiterDashboardPage() {
  const { data: user } = useMe();
  return (
    <>
      <PageHeader title="Hello," accent={user?.full_name.split(" ")[0]} description="Hiring analytics will appear here." />
      <div className="rounded-3xl border bg-card shadow-card">
        <EmptyState title="Analytics coming soon" description="Stat cards, charts and funnels arrive in Phase 7." />
      </div>
    </>
  );
}