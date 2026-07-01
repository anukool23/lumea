import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Admin configuration</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-background divide-y divide-border/60">
        {[
          { label: "Admin email",    value: process.env.ADMIN_EMAIL ?? "Not set",           hint: "Set via ADMIN_EMAIL env var" },
          { label: "Redis URL",      value: process.env.UPSTASH_REDIS_REST_URL ? "Configured" : "Not set", hint: "UPSTASH_REDIS_REST_URL" },
          { label: "Internal key",   value: process.env.INTERNAL_API_KEY ? "Set" : "Not set",   hint: "INTERNAL_API_KEY" },
        ].map(({ label, value, hint }) => (
          <div key={label} className="flex items-center justify-between px-5 py-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground font-mono">{hint}</p>
            </div>
            <span className="text-sm text-muted-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
