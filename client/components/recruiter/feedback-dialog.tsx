"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitFeedback } from "@/hooks/use-interviews";
import { applyServerErrors } from "@/lib/forms";
import { feedbackSchema, type FeedbackValues } from "@/lib/validators";
import type { Interview, Recommendation } from "@/types/api";

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  strong_yes: "Strong yes",
  yes: "Yes",
  no: "No",
  strong_no: "Strong no",
};

const RATINGS = [
  { name: "technical", label: "Technical" },
  { name: "communication", label: "Communication" },
  { name: "problem_solving", label: "Problem solving" },
  { name: "culture", label: "Culture fit" },
] as const;

function FeedbackForm({ interview, onDone }: { interview: Interview; onDone: () => void }) {
  const mutation = useSubmitFeedback();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FeedbackValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      ratings: { technical: "3", communication: "3", problem_solving: "3", culture: "3" },
      strengths: "",
      concerns: "",
      recommendation: "yes",
    },
  });

  const onSubmit = handleSubmit((v) =>
    mutation.mutate(
      {
        id: interview.id,
        body: {
          ratings: {
            technical: Number(v.ratings.technical),
            communication: Number(v.ratings.communication),
            problem_solving: Number(v.ratings.problem_solving),
            culture: Number(v.ratings.culture),
          },
          strengths: v.strengths,
          concerns: v.concerns,
          recommendation: v.recommendation,
        },
      },
      { onSuccess: onDone, onError: (e) => applyServerErrors(e, setError) },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {RATINGS.map(({ name, label }) => (
          <Field key={name} id={`fb-${name}`} label={`${label} (1 to 5)`} error={errors.ratings?.[name]?.message}>
            <Controller
              control={control}
              name={`ratings.${name}`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`fb-${name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        ))}
      </div>
      <Field id="fb-strengths" label="Strengths" error={errors.strengths?.message}>
        <Textarea id="fb-strengths" rows={3} {...register("strengths")} />
      </Field>
      <Field id="fb-concerns" label="Concerns" hint="Optional" error={errors.concerns?.message}>
        <Textarea id="fb-concerns" rows={3} {...register("concerns")} />
      </Field>
      <Field id="fb-rec" label="Recommendation" error={errors.recommendation?.message}>
        <Controller
          control={control}
          name="recommendation"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="fb-rec">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RECOMMENDATION_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <DialogFooter>
        <Button type="submit" variant="lime" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save feedback"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FeedbackDialog({ interview }: { interview: Interview }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Add feedback for ${interview.candidate_name}`}>
          Add feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Interview feedback</DialogTitle>
          <DialogDescription>Rate the interview with {interview.candidate_name}. Keep it factual.</DialogDescription>
        </DialogHeader>
        <FeedbackForm interview={interview} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}