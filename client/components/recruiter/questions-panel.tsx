"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { SectionCard } from "@/components/candidate/section-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/shared/form-field";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteQuestion,
  useGenerateQuestions,
  useQuestions,
  useRegenerateQuestion,
  useUpdateQuestion,
} from "@/hooks/use-questions";
import { questionGenSchema, type QuestionGenValues } from "@/lib/validators";
import type { Difficulty, InterviewQuestion } from "@/types/api";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function GenerateForm({ applicationId }: { applicationId: number }) {
  const generate = useGenerateQuestions();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuestionGenValues>({
    resolver: zodResolver(questionGenSchema),
    defaultValues: {
      counts: { beginner: "2", intermediate: "2", advanced: "1" },
      include_project_questions: true,
    },
  });

  const onSubmit = handleSubmit((v) =>
    generate.mutate({
      appId: applicationId,
      body: {
        counts: {
          beginner: Number(v.counts.beginner),
          intermediate: Number(v.counts.intermediate),
          advanced: Number(v.counts.advanced),
        },
        include_project_questions: v.include_project_questions,
      },
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="q-beginner" label="Beginner" error={errors.counts?.beginner?.message}>
          <Input id="q-beginner" type="number" min={0} max={10} {...register("counts.beginner")} />
        </Field>
        <Field id="q-intermediate" label="Intermediate" error={errors.counts?.intermediate?.message}>
          <Input id="q-intermediate" type="number" min={0} max={10} {...register("counts.intermediate")} />
        </Field>
        <Field id="q-advanced" label="Advanced" error={errors.counts?.advanced?.message}>
          <Input id="q-advanced" type="number" min={0} max={10} {...register("counts.advanced")} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-forest-950">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-forest-900/30 accent-forest-800"
            {...register("include_project_questions")}
          />
          Include questions about the candidate&apos;s projects
        </label>
        <Button type="submit" variant="lime" size="sm" disabled={generate.isPending}>
          <Sparkles aria-hidden />
          {generate.isPending ? "Generating…" : "Generate questions"}
        </Button>
      </div>
    </form>
  );
}

function QuestionItem({ question }: { question: InterviewQuestion }) {
  const update = useUpdateQuestion();
  const remove = useDeleteQuestion();
  const regenerate = useRegenerateQuestion();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);
  const [guideline, setGuideline] = useState(question.answer_guideline);
  const [error, setError] = useState<string | null>(null);

  const busy = remove.isPending || (regenerate.isPending && regenerate.variables === question.id);

  function save() {
    if (text.trim().length < 5) {
      setError("The question needs at least 5 characters.");
      return;
    }
    setError(null);
    update.mutate(
      { id: question.id, body: { text: text.trim(), answer_guideline: guideline.trim() } },
      { onSuccess: () => setEditing(false) },
    );
  }

  function startEdit() {
    setText(question.text);
    setGuideline(question.answer_guideline);
    setError(null);
    setEditing(true);
  }

  return (
    <li className="rounded-2xl border border-forest-900/10 bg-cream-50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-forest-950 px-2 py-0.5 font-medium text-cream-50">
          {DIFFICULTY_LABEL[question.difficulty]}
        </span>
        <span className="rounded-full bg-cream-200 px-2 py-0.5 text-forest-950">
          {question.category === "project" ? "Project" : "Role"}
        </span>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <Field id={`q-text-${question.id}`} label="Question" error={error ?? undefined}>
            <Textarea id={`q-text-${question.id}`} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Field id={`q-guide-${question.id}`} label="Answer guideline">
            <Textarea
              id={`q-guide-${question.id}`}
              rows={3}
              value={guideline}
              onChange={(e) => setGuideline(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="button" variant="lime" size="sm" disabled={update.isPending} onClick={save}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm font-medium text-forest-950">{question.text}</p>
          <div className="mt-2 rounded-xl bg-cream-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-forest-900/60">Answer guideline</p>
            <p className="mt-1 whitespace-pre-line text-sm text-forest-950">{question.answer_guideline}</p>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={startEdit} aria-label="Edit question">
              <Pencil aria-hidden />
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => regenerate.mutate(question.id)}
              aria-label="Regenerate question"
            >
              <RefreshCw aria-hidden />
              {regenerate.isPending && regenerate.variables === question.id ? "Regenerating…" : "Regenerate"}
            </Button>
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label="Delete question">
                  <Trash2 aria-hidden />
                  Delete
                </Button>
              }
              title="Delete this question?"
              description="It will be removed from the interview question list."
              confirmLabel="Delete"
              destructive
              onConfirm={() => remove.mutate(question.id)}
            />
          </div>
        </>
      )}
    </li>
  );
}

export function QuestionsPanel({ applicationId }: { applicationId: number }) {
  const questions = useQuestions(applicationId);

  return (
    <SectionCard
      title="Interview questions"
      description="Generated from the job and this resume. Edit anything before you use it."
    >
      <GenerateForm applicationId={applicationId} />
      <div className="mt-6">
        {questions.isError ? (
          <ErrorState onRetry={() => questions.refetch()} />
        ) : questions.isPending ? (
          <p className="text-sm text-forest-900/70">Loading questions…</p>
        ) : questions.data.length === 0 ? (
          <EmptyState title="No questions yet" description="Choose how many you need and generate a set." />
        ) : (
          <ul className="space-y-3">
            {questions.data.map((q) => (
              <QuestionItem key={q.id} question={q} />
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}