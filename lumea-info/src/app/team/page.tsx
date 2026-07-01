import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Team",
  description: "Meet the people behind Lumea.",
};

const TEAM = [
  {
    name: "Anukool Patel",
    role: "Co-founder & Engineer",
    bio: "Built open-source tools for developers. Cares about fast software and good design.",
    href: "https://github.com/anukoolpatel",
  },
  {
    name: "Lumea Team",
    role: "Design & Product",
    bio: "Obsessed with reading experiences, accessibility, and making complex things feel simple.",
    href: null,
  },
];

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-20">
      <div className="space-y-2 mb-12">
        <p className="text-sm text-muted-foreground uppercase tracking-widest">People</p>
        <h1 className="text-3xl font-bold tracking-tight">A small team with big opinions about writing</h1>
      </div>

      <div className="space-y-6">
        {TEAM.map((person) => (
          <div key={person.name}
            className="rounded-xl border border-border/60 bg-muted/30 px-6 py-5 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-base">{person.name}</h2>
                <p className="text-sm text-muted-foreground">{person.role}</p>
              </div>
              {person.href && (
                <Link href={person.href} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  GitHub ↗
                </Link>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{person.bio}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 pt-10 border-t border-border/60">
        <p className="text-sm text-muted-foreground mb-4">Interested in joining?</p>
        <Link href="/contact"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground h-9 px-5 text-sm font-medium hover:bg-primary/90 transition-colors">
          Reach out
        </Link>
      </div>
    </div>
  );
}
