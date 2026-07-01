import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: "Lumea is an independent writing platform built for writers who care about their craft.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-20">
      <div className="space-y-2 mb-12">
        <p className="text-sm text-muted-foreground uppercase tracking-widest">About us</p>
        <h1 className="text-3xl font-bold tracking-tight">We believe good writing deserves a better home</h1>
      </div>

      <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
        <p>
          Lumea started with a simple frustration: most publishing platforms are either too complex, too cluttered with ads and recommendations, or optimise for engagement metrics instead of genuine reading.
        </p>
        <p>
          We set out to build something different — a minimal, fast, independent publishing space where the writing is the product. No algorithmic feeds. No promoted posts. Just ideas, clearly presented.
        </p>
        <p>
          The name <em className="text-foreground">lumea</em> comes from the Romanian word for "world." Writing is how we make sense of the world around us, and we wanted a name that felt expansive without being pretentious.
        </p>
        <p>
          Lumea is built by a small team. We care deeply about typography, load times, and the reading experience. Every design decision is made with one question in mind: does this help the reader, or distract them?
        </p>
      </div>

      <div className="mt-16 pt-10 border-t border-border/60 flex flex-col sm:flex-row gap-4">
        <Link href="/team"
          className="inline-flex items-center gap-2 rounded-md border border-border h-9 px-5 text-sm font-medium hover:bg-muted/50 transition-colors">
          Meet the team
        </Link>
        <Link href="/contact"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground h-9 px-5 text-sm font-medium hover:bg-primary/90 transition-colors">
          Get in touch
        </Link>
      </div>
    </div>
  );
}
