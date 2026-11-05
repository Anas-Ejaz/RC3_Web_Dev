import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function SectionCard({ title, description, action, className, children }: SectionCardProps) {
  return (
    <section className={cn("rounded-3xl bg-white p-6 shadow-card", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-forest-950">{title}</h2>
          {description && <p className="mt-1 text-sm text-forest-900/70">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}