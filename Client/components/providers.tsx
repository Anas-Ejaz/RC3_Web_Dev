"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { isApiError } from "@/lib/api";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!USE_MOCKS);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2,
          },
        },
      }),
  );

  useEffect(() => {
    if (!USE_MOCKS) return;
    import("@/lib/mocks/browser")
      .then(({ worker }) => worker.start({ onUnhandledRequest: "bypass" }))
      .then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}