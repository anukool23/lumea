import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const links = {
  Product: [
    { label: "Home", href: "/" },
    { label: "Search", href: "/search" },
    { label: "Write", href: process.env.NEXT_PUBLIC_WRITE_URL ?? "https://write.lumea.ink" },
  ],
  Company: [
    { label: "About", href: "https://info.lumea.ink/about" },
    { label: "Blog", href: "https://info.lumea.ink/blog" },
    { label: "Careers", href: "https://info.lumea.ink/careers" },
  ],
  Legal: [
    { label: "Privacy", href: "https://info.lumea.ink/privacy" },
    { label: "Terms", href: "https://info.lumea.ink/terms" },
    { label: "Contact", href: "https://info.lumea.ink/contact" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              lumea
            </Link>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              A space for ideas worth sharing.
            </p>
          </div>

          {/* Link groups */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {group}
              </p>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Lumea. All rights reserved.</p>
          <p>Made with care · India</p>
        </div>
      </div>
    </footer>
  );
}
