"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "healthy" | "degraded" | "down" | "unknown";

interface ServiceStatus {
  name: string;
  status: Status;
  latency?: number; // ms
  lastChecked?: string;
  url: string;
}

const SERVICES: ServiceStatus[] = [
  { name: "lumea-post",          status: "unknown", url: "/api/admin/health/post" },
  { name: "lumea-auth",          status: "unknown", url: "/api/admin/health/auth" },
  { name: "lumea-comms",         status: "unknown", url: "/api/admin/health/comms" },
  { name: "lumea-analytics",     status: "unknown", url: "/api/admin/health/analytics" },
  { name: "lumea-notifications", status: "unknown", url: "/api/admin/health/notifications" },
  { name: "lumea-interaction",   status: "unknown", url: "/api/admin/health/interaction" },
  { name: "lumea-ai",            status: "unknown", url: "/api/admin/health/ai" },
];

const STATUS_COLOR: Record<Status, string> = {
  healthy:  "bg-success text-success-foreground",
  degraded: "bg-warning text-warning-foreground",
  down:     "bg-destructive text-destructive-foreground",
  unknown:  "bg-muted text-muted-foreground",
};

const STATUS_DOT: Record<Status, string> = {
  healthy:  "bg-success",
  degraded: "bg-warning",
  down:     "bg-destructive",
  unknown:  "bg-muted-foreground",
};

export function ServiceHealthGrid() {
  const [services, setServices] = useState<ServiceStatus[]>(SERVICES);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function checkAll() {
      const results = await Promise.all(
        SERVICES.map(async (svc) => {
          const start = Date.now();
          try {
            const res = await fetch(svc.url, { signal: AbortSignal.timeout(5000) });
            const latency = Date.now() - start;
            const status: Status = res.ok ? "healthy" : "degraded";
            return { ...svc, status, latency, lastChecked: new Date().toLocaleTimeString() };
          } catch {
            return { ...svc, status: "down" as Status, lastChecked: new Date().toLocaleTimeString() };
          }
        })
      );
      setServices(results);
      setLoading(false);
    }
    checkAll();
    const interval = setInterval(checkAll, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Service health</h2>
        <span className="text-xs text-muted-foreground">Auto-refreshes every 30s</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {services.map((svc) => (
          <div key={svc.name}
            className="rounded-xl border border-border/60 bg-background px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{svc.name}</span>
              <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", STATUS_COLOR[svc.status])}>
                {svc.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[svc.status],
                svc.status === "healthy" && !loading && "animate-pulse")} />
              <span className="text-xs text-muted-foreground">
                {svc.latency !== undefined ? `${svc.latency}ms` : loading ? "Checking…" : "—"}
              </span>
              {svc.lastChecked && (
                <span className="text-xs text-muted-foreground ml-auto">{svc.lastChecked}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
