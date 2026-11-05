"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { ChipsInput } from "@/components/candidate/chips-input";
import { SectionCard } from "@/components/candidate/section-card";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateProfile } from "@/hooks/use-candidate";
import type { ProfileLike } from "@/lib/completeness";
import { applyServerErrors } from "@/lib/forms";
import { profileSchema, type ProfileValues } from "@/lib/validators";

function toValues(profile: ProfileLike): ProfileValues {
  return {
    headline: profile.headline ?? "",
    phone: profile.phone ?? "",
    location: profile.location ?? "",
    summary: profile.summary ?? "",
    interests: profile.interests ?? [],
  };
}

export function ProfileForm({ profile }: { profile: ProfileLike }) {
  const update = useUpdateProfile();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: toValues(profile),
  });

  const onSubmit = handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: (saved) => reset(toValues(saved)),
      onError: (e) => applyServerErrors(e, setError),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <SectionCard title="About you" description="This helps recruiters and our matching understand your goals.">
        <div className="space-y-4">
          <Field id="headline" label="Headline" error={errors.headline?.message}>
            <Input id="headline" placeholder="e.g. Frontend developer" {...register("headline")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="phone" label="Phone" error={errors.phone?.message}>
              <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
            </Field>
            <Field id="location" label="Location" error={errors.location?.message}>
              <Input id="location" autoComplete="address-level2" {...register("location")} />
            </Field>
          </div>
          <Field
            id="interests"
            label="Interests"
            hint="Press Enter or comma to add. Up to 15."
            error={errors.interests?.message}
          >
            <Controller
              control={control}
              name="interests"
              render={({ field }) => (
                <ChipsInput
                  id="interests"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="e.g. Machine learning"
                />
              )}
            />
          </Field>
          <Field id="summary" label="Summary" hint="Up to 1000 characters." error={errors.summary?.message}>
            <Textarea id="summary" rows={5} {...register("summary")} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="submit" variant="lime" disabled={!isDirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </SectionCard>
    </form>
  );
}