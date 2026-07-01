"use client";

import { useEffect, useState } from "react";

interface ActivityItem {
  id: string;
  type: "post" | "user" | "error" | "deploy";
  message: string;
  timestamp: string;
}

const TYPE_ICON: Record<ActivityItem["type"], string> = {
  post:   "📄",
  user:   "👤",
  error:  "⚠️",
  deploy: "🚀",
};

export function RecentActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    fetch("/api/admin/activity")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => {});
  }, []);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-background px-5 py-8 text-center">
        <p className="text-sm text-muted-foreground">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Recent activity</h2>
      <div className="rounded-xl border border-border/60 bg-background divide-y divide-border/60">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 px-4 py-3">
            <span className="text-base mt-0.5">{TYPE_ICON[item.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{item.message}</p>
              <p className="text-xs text-muted-foreground">{item.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
