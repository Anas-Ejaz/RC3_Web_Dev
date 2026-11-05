import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GuestGuard } from "@/components/auth/guards";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account · Talentra" };

export default function RegisterPage() {
  return (
    <Suspense>
      <GuestGuard>
        <AuthShell title="Create your" accent="account" subtitle="Choose your role to get started. It takes under a minute.">
          <RegisterForm />
        </AuthShell>
      </GuestGuard>
    </Suspense>
  );
}