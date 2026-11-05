"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { Controller, FormProvider, useForm } from "react-hook-form";

import { SectionCard } from "@/components/candidate/section-card";
import { SkillReqEditor } from "@/components/recruiter/skill-req-editor";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateJob, useExtractRequirements, useUpdateJob } from "@/hooks/use-recruiter-jobs";
import { JOB_TYPE_LABEL } from "@/lib/constants";
import { applyServerErrors } from "@/lib/forms";
import { toast } from "@/lib/toast";
import { jobSchema, type JobValues } from "@/lib/validators";
import type { Job, JobInput } from "@/types/api";

const NEW_JOB: JobValues = {
  title: "",
  department: "",
  location: "",
  type: "full_time",
  salary_min: "",
  salary_max: "",
  currency: "USD",
  min_experience_years: "0",
  description: "",
  required_skills: [],
  preferred_skills: [],
  qualifications: "",
};

function toJobValues(job: Job): JobValues {
  return {
    title: job.title,
    department: job.department,
    location: job.location,
    type: job.type,
    salary_min: job.salary_min == null ? "" : String(job.salary_min),
    salary_max: job.salary_max == null ? "" : String(job.salary_max),
    currency: job.currency,
    min_experience_years: String(job.min_experience_years),
    description: job.description,
    required_skills: job.required_skills,
    preferred_skills: job.preferred_skills,
    qualifications: job.qualifications.join("\n"),
  };
}

function toJobInput(values: JobValues): JobInput {
  return {
    title: values.title,
    department: values.department,
    location: values.location,
    type: values.type,
    salary_min: values.salary_min === "" ? null : Number(values.salary_min),
    salary_max: values.salary_max === "" ? null : Number(values.salary_max),
    currency: values.currency.toUpperCase(),
    min_experience_years: Number(values.min_experience_years),
    description: values.description,
    required_skills: values.required_skills,
    preferred_skills: values.preferred_skills,
    qualifications: values.qualifications
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

function mergeSkills(existing: JobValues["required_skills"], incoming: JobValues["required_skills"]) {
  const known = new Set(existing.map((s) => s.name.toLowerCase()));
  return [...existing, ...incoming.filter((s) => !known.has(s.name.toLowerCase()))];
}

function mergeLines(existing: string, incoming: string[]) {
  const lines = existing
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const known = new Set(lines.map((line) => line.toLowerCase()));
  return [...lines, ...incoming.filter((line) => !known.has(line.toLowerCase()))].join("\n");
}

interface JobFormProps {
  job?: Job;
  onCreated?: (job: Job) => void;
}

export function JobForm({ job, onCreated }: JobFormProps) {
  const create = useCreateJob();
  const save = useUpdateJob();
  const extract = useExtractRequirements();

  const form = useForm<JobValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: job ? toJobValues(job) : NEW_JOB,
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors, isDirty },
  } = form;

  const description = watch("description");
  const isSaving = create.isPending || save.isPending;

  function handleExtract() {
    extract.mutate(getValues("description"), {
      onSuccess: (result) => {
        const opts = { shouldDirty: true, shouldValidate: true };
        setValue("required_skills", mergeSkills(getValues("required_skills"), result.required_skills), opts);
        setValue("preferred_skills", mergeSkills(getValues("preferred_skills"), result.preferred_skills), opts);
        const years = getValues("min_experience_years");
        if (years === "" || years === "0") {
          setValue("min_experience_years", String(result.min_experience_years), opts);
        }
        setValue("qualifications", mergeLines(getValues("qualifications"), result.qualifications), opts);
        toast.success("AI suggestions added. Review them before saving.");
      },
    });
  }

  const onSubmit = handleSubmit(
    (values) => {
      const input = toJobInput(values);
      const onError = (e: unknown) => applyServerErrors(e, setError);
      if (job) {
        save.mutate({ id: job.id, input }, { onSuccess: (saved) => reset(toJobValues(saved)), onError });
      } else {
        create.mutate(input, { onSuccess: (created) => onCreated?.(created), onError });
      }
    },
    () => toast.error("Please fix the highlighted fields."),
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <SectionCard title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="title" label="Job title" error={errors.title?.message}>
              <Input id="title" {...register("title")} />
            </Field>
            <Field id="department" label="Department" error={errors.department?.message}>
              <Input id="department" {...register("department")} />
            </Field>
            <Field id="location" label="Location" error={errors.location?.message}>
              <Input id="location" {...register("location")} />
            </Field>
            <Field id="type" label="Job type" error={errors.type?.message}>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(JOB_TYPE_LABEL).map(([value, label]) => (
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
        </SectionCard>

        <SectionCard title="Compensation and experience">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="salary_min" label="Minimum salary" hint="Optional" error={errors.salary_min?.message}>
              <Input id="salary_min" type="number" min={0} inputMode="numeric" {...register("salary_min")} />
            </Field>
            <Field id="salary_max" label="Maximum salary" hint="Optional" error={errors.salary_max?.message}>
              <Input id="salary_max" type="number" min={0} inputMode="numeric" {...register("salary_max")} />
            </Field>
            <Field id="currency" label="Currency" error={errors.currency?.message}>
              <Input id="currency" maxLength={3} {...register("currency")} />
            </Field>
            <Field
              id="min_experience_years"
              label="Minimum experience (years)"
              error={errors.min_experience_years?.message}
            >
              <Input id="min_experience_years" type="number" min={0} max={50} {...register("min_experience_years")} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Description"
          description="Write the role as you would post it. AI can suggest skills and qualifications from it."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExtract}
              disabled={extract.isPending || description.trim().length < 30}
            >
              <Sparkles aria-hidden />
              {extract.isPending ? "Extracting…" : "Extract requirements with AI"}
            </Button>
          }
        >
          <Field
            id="description"
            label="Job description"
            hint="AI suggestions are added to your lists. You decide what to keep."
            error={errors.description?.message}
          >
            <Textarea id="description" rows={10} {...register("description")} />
          </Field>
        </SectionCard>

        <SectionCard title="Requirements">
          <div className="space-y-6">
            <SkillReqEditor
              name="required_skills"
              label="Required skills"
              hint="Importance runs from 1 (minor) to 5 (essential)."
            />
            <SkillReqEditor
              name="preferred_skills"
              label="Preferred skills"
              hint="Nice to have. They count towards the match but are never required."
            />
            <Field
              id="qualifications"
              label="Qualifications"
              hint="One per line."
              error={errors.qualifications?.message}
            >
              <Textarea id="qualifications" rows={4} {...register("qualifications")} />
            </Field>
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <Button type="submit" variant="lime" size="lg" disabled={isSaving || !isDirty}>
            {isSaving ? "Saving…" : job ? "Save changes" : "Post job"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}