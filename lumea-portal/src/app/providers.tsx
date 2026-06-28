"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrate();
      hydrated.current = true;
    }
  }, [hydrate]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
