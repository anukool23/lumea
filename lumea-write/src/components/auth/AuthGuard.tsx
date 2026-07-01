"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, hydrate } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (!user && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
    if (user && PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      router.replace("/");
    }
  }, [user, pathname, router]);

  return <>{children}</>;
}
