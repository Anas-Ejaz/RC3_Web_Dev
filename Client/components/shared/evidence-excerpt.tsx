"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn, escapeRegExp } from "@/lib/utils";

interface EvidenceExcerptProps {
  excerpt?: string;
  highlight?: string[];
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.filter(Boolean);
  if (!clean.length) return <>{text}</>;
  const re = new RegExp(`(${clean.map(escapeRegExp).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        clean.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded bg-lime-soft px-0.5 text-forest-900">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function EvidenceExcerpt({ excerpt, highlight = [], collapsible = false, defaultOpen = false, className }: EvidenceExcerptProps) {
  const [open, setOpen] = useState(defaultOpen || !collapsible);

  if (!excerpt) {
    return <p className={cn("text-sm italic text-muted-foreground", className)}>No resume excerpt available.</p>;
  }

  return (
    <div className={className}>
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mb-1 inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          {open ? "Hide resume excerpt" : "Show resume excerpt"}
        </button>
      )}
      {open && (
        <blockquote className="rounded-xl border-l-4 border-lime-dark bg-cream-200 px-4 py-2.5 text-sm leading-relaxed text-foreground/90">
          <Highlighted text={excerpt} terms={highlight} />
        </blockquote>
      )}
    </div>
  );
}