"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";

interface ChipsInputProps {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
}

export function ChipsInput({ id, value, onChange, placeholder, max = 15 }: ChipsInputProps) {
  const [draft, setDraft] = useState("");

  function commit() {
    const next = draft.trim();
    setDraft("");
    if (!next || value.length >= max) return;
    if (value.some((chip) => chip.toLowerCase() === next.toLowerCase())) return;
    onChange([...value, next]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length >= max ? `Limit of ${max} reached` : placeholder}
        disabled={value.length >= max}
      />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((chip) => (
            <li
              key={chip}
              className="inline-flex items-center gap-1 rounded-full bg-lime-soft py-1 pl-3 pr-1 text-sm text-forest-950"
            >
              {chip}
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item !== chip))}
                aria-label={`Remove ${chip}`}
                className="rounded-full p-1 hover:bg-forest-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}