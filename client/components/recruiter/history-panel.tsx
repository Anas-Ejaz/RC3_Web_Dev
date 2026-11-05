import { SectionCard } from "@/components/candidate/section-card";
import { EmptyState } from "@/components/shared/states";
import { Timeline } from "@/components/shared/timeline";
import { APPLICATION_STATUS_LABEL } from "@/lib/constants";
import type { Application, AuditEntry } from "@/types/api";

const label = (status?: Application["status"] | null) => (status ? APPLICATION_STATUS_LABEL[status] : "New");

export function HistoryPanel({ audit }: { audit: AuditEntry[] }) {
  if (audit.length === 0) {
    return <EmptyState title="No status changes yet" description="Every manual status change is recorded here." />;
  }

  const items = [...audit]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((entry, i) => ({
      id: String(i),
      title: `${label(entry.from_status)} to ${label(entry.to_status)}`,
      description: entry.reason || undefined,
      meta: `Changed by ${entry.changed_by}`,
      date: entry.created_at,
      active: i === 0,
    }));

  return (
    <SectionCard title="Status history" description="A record of who changed the status, when, and why.">
      <Timeline items={items} />
    </SectionCard>
  );
}