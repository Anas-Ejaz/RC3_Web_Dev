import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GuestGuard } from "@/components/auth/guards";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in · Talentra" };

export default function LoginPage() {
  return (
    <Suspense>
      <GuestGuard>
        <AuthShell title="Welcome" accent="back" subtitle="Log in to review candidates, jobs and applications.">
          <LoginForm />
        </AuthShell>
      </GuestGuard>
    </Suspense>
  );
}