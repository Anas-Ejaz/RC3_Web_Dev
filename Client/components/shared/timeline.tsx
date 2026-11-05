import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string | number;
  title: React.ReactNode;
  description?: string;
  meta?: string;
  date?: string;
  active?: boolean;
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-6 border-l-2 border-cream-400 pl-6", className)}>
      {items.map((it) => (
        <li key={it.id} className="relative">
          <span
            className={cn(
              "absolute -left-[33px] top-1 h-3.5 w-3.5 rounded-full border-2 border-background",
              it.active ? "bg-lime-dark ring-2 ring-forest-900" : "bg-cream-400",
            )}
            aria-hidden
          />
          <div className="text-sm font-medium">{it.title}</div>
          {it.description && <p className="mt-0.5 text-sm text-muted-foreground">{it.description}</p>}
          {(it.meta || it.date) && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[it.meta, it.date && formatDateTime(it.date)].filter(Boolean).join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}