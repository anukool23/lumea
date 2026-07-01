import type { Metadata } from "next";
import { OverviewStats }    from "@/components/dashboard/OverviewStats";
import { ServiceHealthGrid } from "@/components/dashboard/ServiceHealthGrid";
import { RecentActivity }   from "@/components/dashboard/RecentActivity";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Lumea system status</p>
      </div>
      <OverviewStats />
      <ServiceHealthGrid />
      <RecentActivity />
    </div>
  );
}
