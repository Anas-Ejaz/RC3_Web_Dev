"use client";

import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, X } from "lucide-react";

import { SectionCard } from "@/components/candidate/section-card";
import { VerifiedBadge } from "@/components/candidate/verified-badge";
import { EvidenceExcerpt } from "@/components/shared/evidence-excerpt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResumeCorrectionValues } from "@/lib/validators";

export function SkillsEditor() {
  const { control } = useFormContext<ResumeCorrectionValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });
  const [draft, setDraft] = useState("");

  function add() {
    const name = draft.trim();
    setDraft("");
    if (!name) return;
    const normalized = name.toLowerCase();
    if (fields.some((field) => field.normalized_name.toLowerCase() === normalized)) return;
    append({ name, normalized_name: normalized, evidence_excerpt: "", verified: false, edited_by: "candidate" });
  }

  return (
    <SectionCard
      title="Skills"
      description="Remove anything that isn't accurate and add what we missed. Skills you add stay unverified until there is evidence for them."
    >
      <div className="flex gap-2">
        <Label htmlFor="new-skill" className="sr-only">
          Add a skill
        </Label>
        <Input
          id="new-skill"
          value={draft}
          placeholder="Add a skill, e.g. TypeScript"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus aria-hidden />
          Add
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="mt-4 text-sm text-forest-900/70">No skills yet. Add the ones that describe your work.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {fields.map((field, index) => (
            <li key={field.id} className="rounded-2xl border border-forest-900/10 bg-cream-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-forest-950">{field.normalized_name}</span>
                <div className="flex items-center gap-1">
                  <VerifiedBadge verified={field.verified} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Remove ${field.normalized_name}`}
                    onClick={() => remove(index)}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              </div>
              {field.evidence_excerpt && (
                <div className="mt-2">
                  <EvidenceExcerpt excerpt={field.evidence_excerpt} collapsible />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}