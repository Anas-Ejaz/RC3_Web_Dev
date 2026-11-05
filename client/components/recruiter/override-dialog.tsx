"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOverrideScore } from "@/hooks/use-recruiter-applications";
import { effectiveScore } from "@/lib/assessment";
import { applyServerErrors } from "@/lib/forms";
import { overrideSchema, type OverrideValues } from "@/lib/validators";
import type { Application, Assessment } from "@/types/api";

interface OverrideFormProps {
  application: Application;
  assessment: Assessment;
  onDone: () => void;
}

function OverrideForm({ application, assessment, onDone }: OverrideFormProps) {
  const mutation = useOverrideScore();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<OverrideValues>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { score: String(effectiveScore(assessment) ?? ""), reason: "" },
  });

  const onSubmit = handleSubmit((values) =>
    mutation.mutate(
      { id: application.id, body: { score: Number(values.score), reason: values.reason } },
      { onSuccess: onDone, onError: (e) => applyServerErrors(e, setError) },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="override-score" label="Score (0 to 100)" error={errors.score?.message}>
        <Input id="override-score" type="number" min={0} max={100} {...register("score")} />
      </Field>
      <Field id="override-reason" label="Reason" hint="Shown alongside the score so the decision is traceable." error={errors.reason?.message}>
        <Textarea id="override-reason" rows={3} {...register("reason")} />
      </Field>
      <DialogFooter>
        <Button type="submit" variant="lime" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Override score"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function OverrideDialog({ application, assessment }: { application: Application; assessment: Assessment }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Override score
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override the AI score</DialogTitle>
          <DialogDescription>
            The AI score of {assessment.overall_score} is kept on record. Your score and reason are shown next to it.
          </DialogDescription>
        </DialogHeader>
        <OverrideForm application={application} assessment={assessment} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}