import Link from "next/link";
import { cn } from "@/lib/utils";

/** Serif italic accent word used in headlines: <Accent>Skills & Goals</Accent> */
export function Accent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-serif italic font-normal", className)}>{children}</span>;
}

export function Logo({ variant = "light", href = "/" }: { variant?: "light" | "dark"; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 text-xl font-semibold tracking-tight",
        variant === "light" ? "text-cream-50" : "text-forest-900",
      )}
      aria-label="Talentra home"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime text-forest-900" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4v16M5 12h8a5 5 0 0 0 0-8H5" />
        </svg>
      </span>
      Talentra
    </Link>
  );
}

export function PageHeader({
  title,
  accent,
  description,
  actions,
}: {
  title: string;
  accent?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          {title} {accent && <Accent>{accent}</Accent>}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}