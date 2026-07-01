import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: {
    default: "Lumea — Ideas worth sharing",
    template: "%s | Lumea",
  },
  description:
    "Discover thoughtful writing on technology, design, and ideas from independent voices.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://lumea.ink"),
  openGraph: {
    type: "website",
    siteName: "Lumea",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@lumea_ink",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
