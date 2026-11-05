"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { SectionCard } from "@/components/candidate/section-card";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddNote } from "@/hooks/use-recruiter-applications";
import { applyServerErrors } from "@/lib/forms";
import { noteSchema, type NoteValues } from "@/lib/validators";
import { formatDateTime } from "@/lib/utils";
import type { Note } from "@/types/api";

interface NotesPanelProps {
  applicationId: number;
  notes: Note[];
}

export function NotesPanel({ applicationId, notes }: NotesPanelProps) {
  const addNote = useAddNote();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<NoteValues>({ resolver: zodResolver(noteSchema), defaultValues: { text: "" } });

  const onSubmit = handleSubmit((values) =>
    addNote.mutate(
      { id: applicationId, text: values.text },
      { onSuccess: () => reset({ text: "" }), onError: (e) => applyServerErrors(e, setError) },
    ),
  );

  const sorted = [...notes].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return (
    <SectionCard title="Private notes" description="Only recruiters can see these. Candidates never do.">
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <Field id="note-text" label="Add a note" error={errors.text?.message}>
          <Textarea id="note-text" rows={3} {...register("text")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="lime" size="sm" disabled={addNote.isPending}>
            {addNote.isPending ? "Adding…" : "Add note"}
          </Button>
        </div>
      </form>
      {sorted.length === 0 ? (
        <p className="mt-6 text-sm text-forest-900/70">No notes yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {sorted.map((note, i) => (
            <li key={`${note.created_at}-${i}`} className="rounded-2xl bg-cream-100 p-4">
              <p className="whitespace-pre-line text-sm text-forest-950">{note.text}</p>
              <p className="mt-2 text-xs text-forest-900/60">{formatDateTime(note.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}