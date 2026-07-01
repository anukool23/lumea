"use client";

import { useState } from "react";
import { RefreshCcw, Trash2 } from "lucide-react";

const CACHE_KEYS = [
  { key: "posts:*",        label: "All posts cache",        desc: "Cached post list and individual posts" },
  { key: "feed:*",         label: "Feed cache",             desc: "Home feed and topic feeds" },
  { key: "user:*",         label: "User profiles",          desc: "Cached user profile data" },
  { key: "analytics:*",    label: "Analytics",              desc: "Dashboard analytics aggregations" },
];

type FlushState = "idle" | "loading" | "ok" | "error";

export default function CachePage() {
  const [states, setStates] = useState<Record<string, FlushState>>({});

  async function flush(key: string) {
    setStates((s) => ({ ...s, [key]: "loading" }));
    try {
      const res = await fetch("/api/admin/cache/flush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: key }),
      });
      setStates((s) => ({ ...s, [key]: res.ok ? "ok" : "error" }));
      if (res.ok) setTimeout(() => setStates((s) => ({ ...s, [key]: "idle" })), 2000);
    } catch {
      setStates((s) => ({ ...s, [key]: "error" }));
    }
  }

  async function flushAll() {
    for (const { key } of CACHE_KEYS) await flush(key);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Cache</h1>
          <p className="text-sm text-muted-foreground">Invalidate Upstash Redis cache keys</p>
        </div>
        <button
          onClick={flushAll}
          className="inline-flex items-center gap-2 rounded-md border border-destructive text-destructive h-8 px-4 text-xs font-medium hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Flush all
        </button>
      </div>

      <div className="rounded-xl border border-border/60 bg-background divide-y divide-border/60">
        {CACHE_KEYS.map(({ key, label, desc }) => {
          const state = states[key] ?? "idle";
          return (
            <div key={key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
                <code className="text-xs text-muted-foreground font-mono">{key}</code>
              </div>
              <button
                onClick={() => flush(key)}
                disabled={state === "loading"}
                className="inline-flex items-center gap-1.5 rounded-md border border-border h-8 px-3 text-xs font-medium hover:bg-muted/50 transition-colors disabled:opacity-60 shrink-0"
              >
                <RefreshCcw className={`h-3 w-3 ${state === "loading" ? "animate-spin" : ""}`} />
                {state === "ok" ? "Flushed" : state === "error" ? "Failed" : "Flush"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
