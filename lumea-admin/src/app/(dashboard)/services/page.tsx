import type { Metadata } from "next";
import { ServiceHealthGrid } from "@/components/dashboard/ServiceHealthGrid";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Services</h1>
        <p className="text-sm text-muted-foreground">Lambda function health across all backend services</p>
      </div>
      <ServiceHealthGrid />
    </div>
  );
}
