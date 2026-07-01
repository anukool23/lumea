"use client";

import { useState } from "react";

export default function SubscribePage() {
  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-20">
      <div className="space-y-2 mb-10">
        <p className="text-sm text-muted-foreground uppercase tracking-widest">Newsletter</p>
        <h1 className="text-3xl font-bold tracking-tight">Stay in the loop</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
          Occasional dispatches on writing, Lumea updates, and things worth reading. No spam, unsubscribe anytime.
        </p>
      </div>

      {status === "ok" ? (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-6 py-8 text-center space-y-2">
          <p className="font-semibold">You're subscribed</p>
          <p className="text-sm text-muted-foreground">Check your inbox for a confirmation email.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-md border border-input bg-background px-3 h-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-md bg-primary text-primary-foreground h-9 px-5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0"
            >
              {status === "loading" ? "…" : "Subscribe"}
            </button>
          </div>
          {status === "error" && (
            <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
          )}
          <p className="text-xs text-muted-foreground">
            By subscribing you agree to our{" "}
            <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</a>.
          </p>
        </form>
      )}
    </div>
  );
}
