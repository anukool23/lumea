import Link from "next/link";
import { ArrowRight, PenLine, Users, Zap } from "lucide-react";

const FEATURES = [
  { icon: PenLine, title: "Write without friction",   desc: "A distraction-free editor with AI assist, scheduling, and SEO tools built in." },
  { icon: Users,   title: "Reach real readers",       desc: "Your posts reach people who genuinely care about ideas — no algorithm games." },
  { icon: Zap,     title: "Built for independence",   desc: "No paywalls, no ads. Lumea is a space where your writing stands on its own." },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {/* Hero */}
      <section className="py-24 sm:py-32 text-center space-y-6">
        <p className="text-sm font-medium text-muted-foreground tracking-widest uppercase">
          Independent writing
        </p>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight max-w-3xl mx-auto">
          A space for ideas worth sharing
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Lumea is a publishing platform for writers who care about their craft — clean, fast, and built to last.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href={process.env.NEXT_PUBLIC_WRITE_URL ?? "https://write.lumea.ink"}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground h-10 px-6 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Start writing
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={process.env.NEXT_PUBLIC_MAIN_URL ?? "https://lumea.ink"}
            className="inline-flex items-center gap-2 rounded-md border border-border h-10 px-6 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            Read posts
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 border-t border-border/60 grid sm:grid-cols-3 gap-10">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="space-y-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>

      {/* CTA strip */}
      <section className="py-16 border-t border-border/60">
        <div className="rounded-2xl bg-muted/50 border border-border/60 px-8 py-12 text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Ready to write?</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Join hundreds of writers publishing on Lumea. Free to start, always.
          </p>
          <Link
            href={process.env.NEXT_PUBLIC_WRITE_URL ?? "https://write.lumea.ink/register"}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground h-9 px-5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Create your account
          </Link>
        </div>
      </section>
    </div>
  );
}
