"use client";

import { useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { JobValues } from "@/lib/validators";

const MAX_SKILLS = 20;
const DEFAULT_IMPORTANCE = 3;

interface SkillReqEditorProps {
  name: "required_skills" | "preferred_skills";
  label: string;
  hint: string;
}

export function SkillReqEditor({ name, label, hint }: SkillReqEditorProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<JobValues>();
  const { fields, append, remove } = useFieldArray({ control, name });
  const [draft, setDraft] = useState("");

  const arrayError = errors[name] as unknown as { root?: { message?: string }; message?: string } | undefined;
  const errorMessage = arrayError?.root?.message ?? arrayError?.message;
  const inputId = `${name}-new`;

  function add() {
    const skill = draft.trim();
    setDraft("");
    if (!skill || fields.length >= MAX_SKILLS) return;
    if (fields.some((f) => f.name.toLowerCase() === skill.toLowerCase())) return;
    append({ name: skill, importance: DEFAULT_IMPORTANCE });
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-forest-950">{label}</legend>
      <p className="text-sm text-forest-900/70">{hint}</p>
      <div className="flex gap-2">
        <Label htmlFor={inputId} className="sr-only">
          Add to {label.toLowerCase()}
        </Label>
        <Input
          id={inputId}
          value={draft}
          placeholder="e.g. TypeScript"
          disabled={fields.length >= MAX_SKILLS}
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
      {fields.length > 0 && (
        <ul className="space-y-2">
          {fields.map((field, index) => (
            <li
              key={field.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-cream-100 px-4 py-2"
            >
              <span className="text-sm font-medium text-forest-950">{field.name}</span>
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name={`${name}.${index}.importance`}
                  render={({ field: importance }) => (
                    <Select
                      value={String(importance.value)}
                      onValueChange={(value) => importance.onChange(Number(value))}
                    >
                      <SelectTrigger className="h-9 w-28" aria-label={`Importance of ${field.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} of 5
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Remove ${field.name}`}
                  onClick={() => remove(index)}
                >
                  <X aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {errorMessage && (
        <p role="alert" className="text-sm text-amber-800">
          {errorMessage}
        </p>
      )}
    </fieldset>
  );
}