"use client";

import { useState } from "react";
import { DateTimePicker } from "react-smart-datetime";
import "react-smart-datetime/styles.css";

export default function ContactPage() {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [message, setMessage] = useState("");
  const [callDate, setCallDate] = useState<Date | undefined>(undefined);
  const [status, setStatus]   = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, callDate: callDate?.toISOString() }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="mx-auto max-w-lg px-4 sm:px-6 py-20 text-center space-y-3">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-semibold">Message sent</h2>
        <p className="text-muted-foreground text-sm">Thanks for reaching out — we'll get back to you within 2 business days.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-20">
      <div className="space-y-2 mb-10">
        <p className="text-sm text-muted-foreground uppercase tracking-widest">Contact</p>
        <h1 className="text-3xl font-bold tracking-tight">Get in touch</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Have a question, feedback, or want to chat? Drop us a message.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="name">Name</label>
          <input
            id="name" type="text" required value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-md border border-input bg-background px-3 h-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <input
            id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-input bg-background px-3 h-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="message">Message</label>
          <textarea
            id="message" required value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5} placeholder="What's on your mind?"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Optional: schedule a call */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Schedule a call <span className="text-muted-foreground font-normal">(optional)</span></label>
          <p className="text-xs text-muted-foreground">Want to hop on a call? Pick a date & time and we'll confirm.</p>
          <DateTimePicker
            mode="datetime"
            value={callDate}
            onChange={setCallDate}
            placeholder="Pick a date & time…"
            clearable
            minDate={new Date()}
            theme="auto"
            closeOnSelect={false}
          />
        </div>

        {status === "error" && (
          <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-md bg-primary text-primary-foreground h-9 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {status === "loading" ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}
