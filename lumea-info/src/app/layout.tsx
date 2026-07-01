import type { Metadata } from "next";
import "./globals.css";
import { InfoNav } from "@/components/layout/InfoNav";
import { InfoFooter } from "@/components/layout/InfoFooter";

export const metadata: Metadata = {
  title: { default: "Lumea — About", template: "%s | Lumea" },
  description: "Lumea is a space for independent writers to share ideas worth reading.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://info.lumea.ink"),
  openGraph: { type: "website", siteName: "Lumea" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="min-h-screen flex flex-col">
          <InfoNav />
          <main className="flex-1">{children}</main>
          <InfoFooter />
        </div>
      </body>
    </html>
  );
}
