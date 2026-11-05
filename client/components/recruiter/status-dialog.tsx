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
import { useSetStatus } from "@/hooks/use-recruiter-applications";
import { APPLICATION_STATUS_LABEL } from "@/lib/constants";
import { applyServerErrors } from "@/lib/forms";
import { MANUAL_STATUSES, statusChangeSchema, type StatusChangeValues } from "@/lib/validators";
import type { Application } from "@/types/api";

function StatusForm({ application, onDone }: { application: Application; onDone: () => void }) {
  const mutation = useSetStatus();
  const options = MANUAL_STATUSES.filter((s) => s !== application.status);
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<StatusChangeValues>({
    resolver: zodResolver(statusChangeSchema),
    defaultValues: { to_status: options[0], reason: "" },
  });

  const rejecting = watch("to_status") === "rejected";

  const onSubmit = handleSubmit((values) =>
    mutation.mutate(
      { id: application.id, body: { to_status: values.to_status, reason: values.reason || undefined } },
      { onSuccess: onDone, onError: (e) => applyServerErrors(e, setError) },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="to_status" label="New status" error={errors.to_status?.message}>
        <Controller
          control={control}
          name="to_status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="to_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((s) => (
                  <SelectItem key={s} value={s}>
                    {APPLICATION_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field
        id="status-reason"
        label="Reason"
        hint={rejecting ? "Required when rejecting." : "Optional. Recorded in the status history."}
        error={errors.reason?.message}
      >
        <Textarea id="status-reason" rows={3} {...register("reason")} />
      </Field>
      <DialogFooter>
        <Button type="submit" variant={rejecting ? "destructive" : "lime"} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : rejecting ? "Reject candidate" : "Update status"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function StatusDialog({ application }: { application: Application }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Change status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
          <DialogDescription>
            Currently {APPLICATION_STATUS_LABEL[application.status]}. Status changes are always manual and are recorded
            in the history.
          </DialogDescription>
        </DialogHeader>
        <StatusForm application={application} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}