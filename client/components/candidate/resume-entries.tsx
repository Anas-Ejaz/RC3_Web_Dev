"use client";

import type { ReactNode } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { ChipsInput } from "@/components/candidate/chips-input";
import { ResumeFormInput } from "@/components/candidate/resume-form-input";
import { SectionCard } from "@/components/candidate/section-card";
import { VerifiedBadge } from "@/components/candidate/verified-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EvidenceExcerpt } from "@/components/shared/evidence-excerpt";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import type { ResumeCorrectionValues } from "@/lib/validators";

interface EntrySectionProps {
  title: string;
  addLabel: string;
  onAdd: () => void;
  isEmpty: boolean;
  children: ReactNode;
}

function EntrySection({ title, addLabel, onAdd, isEmpty, children }: EntrySectionProps) {
  return (
    <SectionCard
      title={title}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus aria-hidden />
          {addLabel}
        </Button>
      }
    >
      {isEmpty ? (
        <p className="text-sm text-forest-900/70">Nothing here yet.</p>
      ) : (
        <ul className="space-y-4">{children}</ul>
      )}
    </SectionCard>
  );
}

interface EntryCardProps {
  title: string;
  evidence: string;
  onRemove: () => void;
  children: ReactNode;
}

function EntryCard({ title, evidence, onRemove, children }: EntryCardProps) {
  return (
    <li className="rounded-2xl border border-forest-900/10 bg-cream-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-forest-950">{title}</h3>
          <VerifiedBadge verified={evidence.trim().length > 0} />
        </div>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="ghost" size="sm">
              <Trash2 aria-hidden />
              Remove
            </Button>
          }
          title={`Remove ${title}?`}
          description="This entry is deleted when you save your corrections."
          confirmLabel="Remove"
          destructive
          onConfirm={onRemove}
        />
      </div>
      <div className="space-y-3">{children}</div>
      {evidence && (
        <div className="mt-3">
          <EvidenceExcerpt excerpt={evidence} collapsible />
        </div>
      )}
    </li>
  );
}

export function EducationSection() {
  const { control } = useFormContext<ResumeCorrectionValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "education" });
  return (
    <EntrySection
      title="Education"
      addLabel="Add education"
      onAdd={() => append({ degree: "", institution: "", year: "", evidence_excerpt: "" })}
      isEmpty={fields.length === 0}
    >
      {fields.map((field, i) => (
        <EntryCard key={field.id} title={`Education ${i + 1}`} evidence={field.evidence_excerpt} onRemove={() => remove(i)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <ResumeFormInput name={`education.${i}.degree`} label="Degree" />
            <ResumeFormInput name={`education.${i}.institution`} label="Institution" />
            <ResumeFormInput name={`education.${i}.year`} label="Year" />
          </div>
        </EntryCard>
      ))}
    </EntrySection>
  );
}

export function ExperienceSection() {
  const { control } = useFormContext<ResumeCorrectionValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "experience" });
  return (
    <EntrySection
      title="Experience"
      addLabel="Add experience"
      onAdd={() =>
        append({ title: "", company: "", start: "", end: "", years: 0, summary: "", evidence_excerpt: "" })
      }
      isEmpty={fields.length === 0}
    >
      {fields.map((field, i) => (
        <EntryCard key={field.id} title={`Experience ${i + 1}`} evidence={field.evidence_excerpt} onRemove={() => remove(i)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <ResumeFormInput name={`experience.${i}.title`} label="Job title" />
            <ResumeFormInput name={`experience.${i}.company`} label="Company" />
            <ResumeFormInput name={`experience.${i}.start`} label="Start" />
            <ResumeFormInput name={`experience.${i}.end`} label="End" />
            <ResumeFormInput name={`experience.${i}.years`} label="Years" numeric />
          </div>
          <ResumeFormInput name={`experience.${i}.summary`} label="Summary" multiline />
        </EntryCard>
      ))}
    </EntrySection>
  );
}

export function ProjectsSection() {
  const { control } = useFormContext<ResumeCorrectionValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "projects" });
  return (
    <EntrySection
      title="Projects"
      addLabel="Add project"
      onAdd={() => append({ name: "", description: "", technologies: [], evidence_excerpt: "" })}
      isEmpty={fields.length === 0}
    >
      {fields.map((field, i) => (
        <EntryCard key={field.id} title={`Project ${i + 1}`} evidence={field.evidence_excerpt} onRemove={() => remove(i)}>
          <ResumeFormInput name={`projects.${i}.name`} label="Project name" />
          <ResumeFormInput name={`projects.${i}.description`} label="Description" multiline />
          <Field id={`projects-${i}-technologies`} label="Technologies" hint="Press Enter or comma to add.">
            <Controller
              control={control}
              name={`projects.${i}.technologies`}
              render={({ field: tech }) => (
                <ChipsInput
                  id={`projects-${i}-technologies`}
                  value={tech.value}
                  onChange={tech.onChange}
                  placeholder="e.g. React"
                />
              )}
            />
          </Field>
        </EntryCard>
      ))}
    </EntrySection>
  );
}