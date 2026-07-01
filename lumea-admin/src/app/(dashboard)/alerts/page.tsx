import type { Metadata } from "next";

export const metadata: Metadata = { title: "Alerts" };

export default function AlertsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Alerts</h1>
        <p className="text-sm text-muted-foreground">System errors and Lambda invocation failures</p>
      </div>
      <div className="rounded-xl border border-border/60 bg-background px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">No alerts. All services running normally.</p>
      </div>
    </div>
  );
}
