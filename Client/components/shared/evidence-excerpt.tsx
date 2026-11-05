"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

interface EvidenceExcerptProps {
  excerpt: string;
  /** Term or terms to mark inside the excerpt. */
  highlight?: string | string[];
  /** Clamp long excerpts and let the reader expand them. */
  collapsible?: boolean;
  className?: string;
}

const COLLAPSE_AFTER = 160;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlighted(text: string, highlight?: string | string[]) {
  const terms = (Array.isArray(highlight) ? highlight : highlight ? [highlight] : [])
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const lowered = terms.map((t) => t.toLowerCase());

  return text.split(pattern).map((part, i) =>
    lowered.includes(part.toLowerCase()) ? (
      <mark key={i} className="rounded bg-lime-200 px-0.5 text-forest-950">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function EvidenceExcerpt({ excerpt, highlight, collapsible = false, className }: EvidenceExcerptProps) {
  const [open, setOpen] = useState(false);
  const canCollapse = collapsible && excerpt.length > COLLAPSE_AFTER;
  const clamped = canCollapse && !open;

  return (
    <blockquote className={cn("rounded-xl border-l-4 border-forest-700/40 bg-cream-100 px-4 py-3", className)}>
      <p className={cn("whitespace-pre-line text-sm leading-relaxed text-forest-950", clamped && "line-clamp-3")}>
        {renderHighlighted(excerpt, highlight)}
      </p>
      {canCollapse && (
        <button
          type="button"
          className="mt-2 rounded text-xs font-medium text-forest-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </blockquote>
  );
}