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
import { useDecision } from "@/hooks/use-interviews";
import { applyServerErrors } from "@/lib/forms";
import { decisionSchema, type DecisionValues } from "@/lib/validators";
import type { Application } from "@/types/api";

function DecisionForm({ application, onDone }: { application: Application; onDone: () => void }) {
  const mutation = useDecision();
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<DecisionValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: "selected", reason: "" },
  });
  const rejecting = watch("decision") === "not_selected";

  const onSubmit = handleSubmit((v) =>
    mutation.mutate(
      { id: application.id, body: v },
      { onSuccess: onDone, onError: (e) => applyServerErrors(e, setError) },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="decision" label="Decision" error={errors.decision?.message}>
        <Controller
          control={control}
          name="decision"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="decision">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="selected">Selected</SelectItem>
                <SelectItem value="not_selected">Not selected</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field id="decision-reason" label="Reason" hint="Recorded in the status history." error={errors.reason?.message}>
        <Textarea id="decision-reason" rows={3} {...register("reason")} />
      </Field>
      <DialogFooter>
        <Button type="submit" variant={rejecting ? "destructive" : "lime"} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : rejecting ? "Confirm: not selected" : "Confirm: selected"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function DecisionDialog({ application }: { application: Application }) {
  const [open, setOpen] = useState(false);
  const decided = application.status === "selected" || application.status === "not_selected";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={decided}>
          {decided ? "Decision recorded" : "Record final decision"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Final decision</DialogTitle>
          <DialogDescription>
            This is your decision, not the AI&apos;s. The candidate is notified once you confirm.
          </DialogDescription>
        </DialogHeader>
        <DecisionForm application={application} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}