import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Lumea Write", template: "%s | Lumea Write" },
  description: "Write, schedule, and publish your ideas on Lumea.",
  robots: { index: false },   // writer app — no public indexing
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
