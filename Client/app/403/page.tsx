"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Accent } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-auth";
import { homeFor } from "@/lib/routes";

export default function ForbiddenPage() {
  const { data: user } = useMe();

  return (
    <main className="grid min-h-screen place-items-center p-3">
      <div className="w-full max-w-xl rounded-3xl bg-forest-hero p-10 text-center text-cream-50 sm:p-14">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lime text-forest-900">
          <ShieldAlert className="h-7 w-7" aria-hidden />
        </span>
        <p className="mt-6 font-serif text-8xl italic leading-none">403</p>
        <h1 className="mt-4 text-3xl font-medium tracking-tight">
          This page is <Accent>off limits</Accent>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-cream-50/70">Your account role does not have access to this area.</p>
        <Button asChild variant="lime" size="lg" className="mt-8">
          <Link href={user ? homeFor(user.role) : "/login"}>{user ? "Back to my dashboard" : "Log in"}</Link>
        </Button>
      </div>
    </main>
  );
}