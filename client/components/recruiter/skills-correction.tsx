"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { SectionCard } from "@/components/candidate/section-card";
import { VerifiedBadge } from "@/components/candidate/verified-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EvidenceExcerpt } from "@/components/shared/evidence-excerpt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateSkills } from "@/hooks/use-recruiter-applications";
import type { ResumeSkill } from "@/types/api";

interface SkillsCorrectionProps {
  applicationId: number;
  skills: ResumeSkill[];
}

const signature = (items: ResumeSkill[]) =>
  items
    .map((s) => s.normalized_name)
    .sort()
    .join("|");

export function SkillsCorrection({ applicationId, skills }: SkillsCorrectionProps) {
  const [items, setItems] = useState<ResumeSkill[]>(skills);
  const [draft, setDraft] = useState("");
  const update = useUpdateSkills();

  const dirty = signature(items) !== signature(skills);

  function add() {
    const name = draft.trim();
    setDraft("");
    if (!name) return;
    const normalized = name.toLowerCase();
    if (items.some((s) => s.normalized_name.toLowerCase() === normalized)) return;
    setItems([
      ...items,
      { name, normalized_name: normalized, evidence_excerpt: "", verified: false, edited_by: "recruiter" },
    ]);
  }

  return (
    <SectionCard
      title="Extracted skills"
      description="Correct what the AI extracted. Saving re-scores this application."
      action={
        <ConfirmDialog
          trigger={
            <Button type="button" variant="lime" size="sm" disabled={!dirty || update.isPending}>
              {update.isPending ? "Saving…" : "Save and re-score"}
            </Button>
          }
          title="Save skill corrections?"
          description="The match score will be recalculated from the corrected skills. The change is recorded."
          confirmLabel="Save and re-score"
          onConfirm={() => update.mutate({ id: applicationId, skills: items })}
        />
      }
    >
      <div className="flex gap-2">
        <Label htmlFor="recruiter-new-skill" className="sr-only">
          Add a skill
        </Label>
        <Input
          id="recruiter-new-skill"
          value={draft}
          placeholder="Add a skill the AI missed"
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
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-forest-900/70">No skills were extracted.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((skill) => (
            <li key={skill.normalized_name} className="rounded-2xl border border-forest-900/10 bg-cream-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-forest-950">{skill.normalized_name}</span>
                <div className="flex items-center gap-1">
                  <VerifiedBadge verified={skill.verified} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Remove ${skill.normalized_name}`}
                    onClick={() => setItems(items.filter((s) => s.normalized_name !== skill.normalized_name))}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              </div>
              {skill.edited_by !== "ai" && (
                <p className="mt-1 text-xs text-forest-900/60">Edited by {skill.edited_by}</p>
              )}
              {skill.evidence_excerpt && (
                <div className="mt-2">
                  <EvidenceExcerpt excerpt={skill.evidence_excerpt} collapsible />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}