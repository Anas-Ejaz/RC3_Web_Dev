"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ErrorState } from "@/components/shared/states";
import { useMe } from "@/hooks/use-auth";
import { safeNext } from "@/lib/routes";
import type { Role } from "@/types/api";

export function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-forest-700" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Wraps a role area. Renders nothing from the area until the user is verified to hold the role. */
export function RoleGuard({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading, isError, refetch } = useMe();

  useEffect(() => {
    if (isLoading || isError) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (user.role !== role) router.replace("/403");
  }, [user, isLoading, isError, role, pathname, router]);

  if (isError) {
    return (
      <div className="container py-20">
        <ErrorState message="We could not verify your session." onRetry={() => refetch()} />
      </div>
    );
  }
  if (isLoading || !user || user.role !== role) return <FullPageLoader />;
  return <>{children}</>;
}

/** Wraps login and register. Already-signed-in users are sent to ?next= or their dashboard. Needs a Suspense parent. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: user, isLoading } = useMe();
  const next = params.get("next");

  useEffect(() => {
    if (user) router.replace(safeNext(next, user.role));
  }, [user, next, router]);

  if (isLoading || user) return <FullPageLoader />;
  return <>{children}</>;
}