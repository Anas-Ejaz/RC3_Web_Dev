import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-card">
      <p className="text-sm text-forest-900/70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-forest-950">{value}</p>
      {hint && <p className="mt-1 text-xs text-forest-900/60">{hint}</p>}
    </div>
  );
}