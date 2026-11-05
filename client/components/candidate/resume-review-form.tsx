"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm } from "react-hook-form";

import { ChipsInput } from "@/components/candidate/chips-input";
import { EducationSection, ExperienceSection, ProjectsSection } from "@/components/candidate/resume-entries";
import { ResumeFormInput } from "@/components/candidate/resume-form-input";
import { SectionCard } from "@/components/candidate/section-card";
import { SkillsEditor } from "@/components/candidate/skills-editor";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { useSaveResume } from "@/hooks/use-candidate";
import { applyServerErrors } from "@/lib/forms";
import { toast } from "@/lib/toast";
import { resumeCorrectionSchema, type ResumeCorrectionValues } from "@/lib/validators";
import type { ParsedResume } from "@/types/api";

function toFormValues(resume: ParsedResume): ResumeCorrectionValues {
  return {
    name: resume.name ?? "",
    email: resume.email ?? "",
    phone: resume.phone ?? "",
    links: resume.links ?? [],
    skills: resume.skills,
    education: resume.education,
    experience: resume.experience,
    projects: resume.projects,
  };
}

export function ResumeReviewForm({ resume }: { resume: ParsedResume }) {
  const save = useSaveResume();
  const form = useForm<ResumeCorrectionValues>({
    resolver: zodResolver(resumeCorrectionSchema),
    defaultValues: toFormValues(resume),
  });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isDirty },
  } = form;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const onSubmit = handleSubmit(
    (values) =>
      save.mutate(values, {
        onSuccess: (saved) => reset(toFormValues(saved)),
        onError: (e) => applyServerErrors(e, setError),
      }),
    () => toast.error("Please fix the highlighted fields."),
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <SectionCard title="Contact details">
          <div className="grid gap-4 sm:grid-cols-2">
            <ResumeFormInput name="name" label="Full name" autoComplete="name" />
            <ResumeFormInput name="email" label="Email" type="email" autoComplete="email" />
            <ResumeFormInput name="phone" label="Phone" type="tel" autoComplete="tel" />
          </div>
          <div className="mt-4">
            <Field id="links" label="Links" hint="Portfolio, GitHub, LinkedIn. Press Enter or comma to add.">
              <Controller
                control={control}
                name="links"
                render={({ field }) => (
                  <ChipsInput id="links" value={field.value} onChange={field.onChange} placeholder="https://" max={10} />
                )}
              />
            </Field>
          </div>
        </SectionCard>

        <SkillsEditor />
        <EducationSection />
        <ExperienceSection />
        <ProjectsSection />

        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-full bg-forest-950 px-6 py-3 text-cream-50 shadow-card">
          <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
            {isDirty ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                Unsaved changes
              </>
            ) : (
              "All changes saved"
            )}
          </p>
          <Button type="submit" variant="lime" disabled={!isDirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save corrections"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}