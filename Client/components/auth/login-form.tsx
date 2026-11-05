"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/hooks/use-auth";
import { applyServerErrors } from "@/lib/forms";
import { loginSchema, type LoginValues } from "@/lib/validators";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
const DEMO_ACCOUNTS = [
  { label: "Recruiter", email: "recruiter@demo.com" },
  { label: "Candidate", email: "aisha@demo.com" },
];

export function LoginForm() {
  const params = useSearchParams();
  const query = params.toString();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
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

        <Field id="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-11 rounded-xl bg-card"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...form.register("password")}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Log in
        </Button>
      </form>

      {USE_MOCKS && (
        <div className="mt-6 rounded-2xl border border-dashed bg-cream-200 p-4 text-sm">
          <p className="font-medium">Demo accounts (mock mode)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <Button
                key={a.email}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  form.setValue("email", a.email, { shouldValidate: true });
                  form.setValue("password", "password", { shouldValidate: true });
                }}
              >
                Fill {a.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to Talentra?{" "}
        <Link href={`/register${query ? `?${query}` : ""}`} className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </>
  );
}