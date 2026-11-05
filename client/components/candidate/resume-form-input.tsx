"use client";

import { get, useFormContext, type FieldError, type Path } from "react-hook-form";

import { Field } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ResumeCorrectionValues } from "@/lib/validators";

interface ResumeFormInputProps {
  name: Path<ResumeCorrectionValues>;
  label: string;
  multiline?: boolean;
  numeric?: boolean;
  type?: string;
  autoComplete?: string;
}

export function ResumeFormInput({ name, label, multiline, numeric, type = "text", autoComplete }: ResumeFormInputProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ResumeCorrectionValues>();
  const error = (get(errors, name) as FieldError | undefined)?.message;
  const id = name.replace(/\./g, "-");
  const registered = register(name, numeric ? { valueAsNumber: true } : undefined);

  return (
    <Field id={id} label={label} error={error}>
      {multiline ? (
        <Textarea id={id} rows={3} aria-invalid={error ? true : undefined} {...registered} />
      ) : (
        <Input
          id={id}
          type={numeric ? "number" : type}
          step={numeric ? "any" : undefined}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          {...registered}
        />
      )}
    </Field>
  );
}