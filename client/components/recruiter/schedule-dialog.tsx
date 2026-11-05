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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInterviewers, useScheduleInterview } from "@/hooks/use-interviews";
import { getSchedulingConflicts } from "@/lib/api";
import { applyServerErrors } from "@/lib/forms";
import { toastError } from "@/lib/toast";
import { formatDateTime } from "@/lib/utils";
import { scheduleSchema, type ScheduleValues } from "@/lib/validators";
import type { Application, InterviewInput, InterviewType, SchedulingConflict } from "@/types/api";

export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  technical: "Technical",
  hr: "HR",
  managerial: "Managerial",
  panel: "Panel",
};

function ScheduleForm({ application, onDone }: { application: Application; onDone: () => void }) {
  const interviewers = useInterviewers();
  const schedule = useScheduleInterview();
  const [conflicts, setConflicts] = useState<SchedulingConflict[] | null>(null);
  const [pending, setPending] = useState<InterviewInput | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      date: "",
      time: "",
      duration_minutes: "60",
      interviewer_id: "",
      type: "technical",
      location_or_link: "",
    },
  });

  function send(input: InterviewInput) {
    schedule.mutate(input, {
      onSuccess: () => {
        setConflicts(null);
        onDone();
      },
      onError: (e) => {
        const found = getSchedulingConflicts(e);
        if (found) {
          setPending(input);
          setConflicts(found);
          return;
        }
        applyServerErrors(e, setError);
        toastError(e);
      },
    });
  }

  const onSubmit = handleSubmit((v) =>
    send({
      application_id: application.id,
      scheduled_at: new Date(`${v.date}T${v.time}`).toISOString(),
      duration_minutes: Number(v.duration_minutes),
      interviewer_id: Number(v.interviewer_id),
      type: v.type,
      location_or_link: v.location_or_link,
    }),
  );

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="iv-date" label="Date" error={errors.date?.message}>
            <Input id="iv-date" type="date" {...register("date")} />
          </Field>
          <Field id="iv-time" label="Time" error={errors.time?.message}>
            <Input id="iv-time" type="time" {...register("time")} />
          </Field>
          <Field id="iv-duration" label="Duration (minutes)" error={errors.duration_minutes?.message}>
            <Input id="iv-duration" type="number" min={15} max={480} step={15} {...register("duration_minutes")} />
          </Field>
          <Field id="iv-type" label="Interview type" error={errors.type?.message}>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="iv-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTERVIEW_TYPE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
        <Field id="iv-interviewer" label="Interviewer" error={errors.interviewer_id?.message}>
          <Controller
            control={control}
            name="interviewer_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={interviewers.isPending}>
                <SelectTrigger id="iv-interviewer">
                  <SelectValue placeholder={interviewers.isPending ? "Loading…" : "Choose an interviewer"} />
                </SelectTrigger>
                <SelectContent>
                  {(interviewers.data ?? []).map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>
                      {i.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="iv-location" label="Location or meeting link" error={errors.location_or_link?.message}>
          <Input id="iv-location" placeholder="https://meet.example.com/abc or Room 3" {...register("location_or_link")} />
        </Field>
        <DialogFooter>
          <Button type="submit" variant="lime" disabled={schedule.isPending}>
            {schedule.isPending ? "Scheduling…" : "Schedule interview"}
          </Button>
        </DialogFooter>
      </form>

      <Dialog open={conflicts !== null} onOpenChange={(open) => !open && setConflicts(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scheduling conflict</DialogTitle>
            <DialogDescription>
              This time overlaps with {conflicts?.length === 1 ? "another interview" : "other interviews"}. You can pick a
              different time or schedule anyway.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {(conflicts ?? []).map((c) => (
              <li key={c.interview_id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                {formatDateTime(c.scheduled_at)} with {c.with}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConflicts(null)}>
              Choose another time
            </Button>
            <Button
              type="button"
              variant="lime"
              disabled={schedule.isPending}
              onClick={() => pending && send({ ...pending, force: true })}
            >
              {schedule.isPending ? "Scheduling…" : "Schedule anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ScheduleDialog({ application }: { application: Application }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="lime" size="sm">
          Schedule interview
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule an interview</DialogTitle>
          <DialogDescription>
            With {application.candidate_name}. The application moves to Interview once it is scheduled.
          </DialogDescription>
        </DialogHeader>
        <ScheduleForm application={application} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}