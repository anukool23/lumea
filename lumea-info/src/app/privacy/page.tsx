import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Lumea handles your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-20">
      <div className="space-y-2 mb-10">
        <p className="text-sm text-muted-foreground uppercase tracking-widest">Legal</p>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground">Last updated: July 2025</p>
      </div>

      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">1. Information we collect</h2>
          <p>We collect information you provide directly — your email address when you subscribe or contact us, and account details when you register to write on Lumea.</p>
          <p>We also collect standard server logs (IP address, browser type, pages visited) to operate and improve the service.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">2. How we use it</h2>
          <p>We use your information to provide the service, send you newsletters you've opted into, respond to contact requests, and prevent abuse. We do not sell your data to third parties.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">3. Cookies</h2>
          <p>Lumea uses cookies only for authentication (keeping you logged in). We do not use tracking or advertising cookies.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">4. Data retention</h2>
          <p>We retain your data as long as your account is active. You can request deletion at any time by emailing us at <a href="mailto:privacy@lumea.ink" className="text-foreground underline underline-offset-2">privacy@lumea.ink</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">5. Contact</h2>
          <p>For privacy concerns, email <a href="mailto:privacy@lumea.ink" className="text-foreground underline underline-offset-2">privacy@lumea.ink</a>.</p>
        </section>
      </div>
    </div>
  );
}
