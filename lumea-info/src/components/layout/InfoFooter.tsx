import Link from "next/link";

export function InfoFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Lumea. All rights reserved.</p>
        <div className="flex gap-5">
          {[
            { href: "/privacy", label: "Privacy" },
            { href: "/terms",   label: "Terms" },
            { href: "/contact", label: "Contact" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
