import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Lumea terms of service.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-20">
      <div className="space-y-2 mb-10">
        <p className="text-sm text-muted-foreground uppercase tracking-widest">Legal</p>
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-xs text-muted-foreground">Last updated: July 2025</p>
      </div>

      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">1. Acceptance</h2>
          <p>By using Lumea you agree to these terms. If you don't agree, please don't use the service.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">2. Your content</h2>
          <p>You own the content you publish. By posting on Lumea you grant us a limited licence to display and distribute it on the platform. You can delete your content at any time.</p>
          <p>You are responsible for ensuring your content does not violate any laws, third-party rights, or our content guidelines.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">3. Prohibited use</h2>
          <p>You may not use Lumea to publish spam, hate speech, harassment, malware, or illegal content. We reserve the right to remove content and suspend accounts that violate these terms.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">4. Availability</h2>
          <p>We aim for high availability but do not guarantee uninterrupted service. We may modify or discontinue features with reasonable notice.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">5. Limitation of liability</h2>
          <p>Lumea is provided "as is." To the extent permitted by law, we are not liable for any indirect or consequential damages arising from your use of the service.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">6. Contact</h2>
          <p>Questions? Email <a href="mailto:hello@lumea.ink" className="text-foreground underline underline-offset-2">hello@lumea.ink</a>.</p>
        </section>
      </div>
    </div>
  );
}
