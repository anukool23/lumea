"use client";

import { useEffect, useState } from "react";

interface Stat { label: string; value: string; delta?: string; }

const MOCK: Stat[] = [
  { label: "Total posts",    value: "—" },
  { label: "Active users",   value: "—" },
  { label: "Emails sent",    value: "—" },
  { label: "AI requests",    value: "—" },
];

export function OverviewStats() {
  const [stats, setStats] = useState<Stat[]>(MOCK);

  useEffect(() => {
    // Fetch from admin API — replace with real endpoints
    async function load() {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // show mock on error
      }
    }
    load();
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label}
          className="rounded-xl border border-border/60 bg-background px-5 py-4 space-y-1">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="text-2xl font-semibold tracking-tight">{s.value}</p>
          {s.delta && <p className="text-xs text-muted-foreground">{s.delta}</p>}
        </div>
      ))}
    </div>
  );
}
