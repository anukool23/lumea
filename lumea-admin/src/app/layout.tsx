import type { Metadata } from "next";
import "./globals.css";
import { AdminGuard } from "@/components/auth/AdminGuard";

export const metadata: Metadata = {
  title: { default: "Lumea Admin", template: "%s | Lumea Admin" },
  description: "Internal admin dashboard for Lumea",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AdminGuard>{children}</AdminGuard>
      </body>
    </html>
  );
}
