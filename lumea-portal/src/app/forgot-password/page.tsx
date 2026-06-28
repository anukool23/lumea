"use client";
import { useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✉️</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Check your inbox</h1>
          <p className="text-zinc-400 text-sm mb-6">
            If an account exists for <strong>{email}</strong>, you'll receive a reset link shortly.
          </p>
          <Link href="/login" className="btn-primary justify-center">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Reset your password</h1>
        <p className="text-zinc-400 text-sm mb-8">Enter your email and we'll send a reset link.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="you@example.com" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-400 mt-6">
          <Link href="/login" className="hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
