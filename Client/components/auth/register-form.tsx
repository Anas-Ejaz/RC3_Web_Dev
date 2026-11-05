"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Loader2, UserRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/hooks/use-auth";
import { applyServerErrors } from "@/lib/forms";
import { registerSchema, type RegisterValues } from "@/lib/validators";

const ROLES = [
  { value: "candidate", title: "I'm looking for work", desc: "Upload a resume, get matched and track applications.", Icon: UserRound },
  { value: "recruiter", title: "I'm hiring", desc: "Post jobs, review explainable scores and schedule interviews.", Icon: Briefcase },
] as const;

export function RegisterForm() {
  const params = useSearchParams();
  const query = params.toString();
  const registerUser = useRegister();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      role: params.get("role") === "recruiter" ? "recruiter" : "candidate",
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    registerUser.mutate(values, {
      onError: (e) => {
        if (!applyServerErrors(e, form.setError)) setFormError(e.message);
      },
    });
  });

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {formError}
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">I want to</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map(({ value, title, desc, Icon }) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" value={value} className="peer sr-only" {...form.register("role")} />
                <div className="h-full rounded-2xl border bg-card p-4 transition peer-checked:border-forest-900 peer-checked:bg-lime-soft/50 peer-checked:ring-2 peer-checked:ring-forest-900 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                  <Icon className="h-5 w-5" aria-hidden />
                  <p className="mt-2 text-sm font-medium">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                </div>
              </label>
            ))}
          </div>
          {errors.role && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
              {errors.role.message}
            </p>
          )}
        </fieldset>

        <Field id="full_name" label="Full name" error={errors.full_name?.message}>
          <Input
            id="full_name"
            autoComplete="name"
            className="h-11 rounded-xl bg-card"
            aria-invalid={!!errors.full_name}
            aria-describedby={errors.full_name ? "full_name-error" : undefined}
            {...form.register("full_name")}
          />
        </Field>

        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className="h-11 rounded-xl bg-card"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...form.register("email")}
          />
        </Field>

        <Field id="password" label="Password" hint="At least 8 characters." error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="h-11 rounded-xl bg-card"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...form.register("password")}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={registerUser.isPending}>
          {registerUser.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/login${query ? `?${query}` : ""}`} className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}