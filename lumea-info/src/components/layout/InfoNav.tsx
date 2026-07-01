import Link from "next/link";

const LINKS = [
  { href: "/about",     label: "About" },
  { href: "/team",      label: "Team" },
  { href: "/contact",   label: "Contact" },
  { href: "/subscribe", label: "Subscribe" },
];

export function InfoNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex h-14 items-center justify-between">
        <Link href="/" className="font-semibold text-base tracking-tight">lumea</Link>
        <nav className="hidden sm:flex items-center gap-6">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href={process.env.NEXT_PUBLIC_MAIN_URL ?? "https://lumea.ink"}
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-8 px-4 text-sm font-medium hover:bg-primary/90 transition-colors">
          Read
        </Link>
      </div>
    </header>
  );
}
