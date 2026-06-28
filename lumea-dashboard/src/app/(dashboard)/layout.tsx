"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-zinc-400 text-sm">Loading...</div>
    </div>
  );

  if (!isAuthenticated) return null;

  return <DashboardLayout>{children}</DashboardLayout>;
}
