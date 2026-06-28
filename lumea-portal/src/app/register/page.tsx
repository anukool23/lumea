"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "", username: "" });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.register(form);
      setStep("otp");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.verifyOTP({ email: form.email, otp });
      router.push("/login?verified=1");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  if (step === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-1">Check your email</h1>
          <p className="text-zinc-400 text-sm mb-8">We sent a 6-digit code to <strong>{form.email}</strong></p>
          <form onSubmit={handleVerify} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
            <input
              value={otp} onChange={e => setOtp(e.target.value)} maxLength={6}
              placeholder="000000"
              className="w-full text-center text-3xl tracking-[0.5em] border border-zinc-200 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <button type="submit" disabled={loading || otp.length < 6} className="btn-primary w-full justify-center py-2.5">
              {loading ? "Verifying..." : "Verify email"}
            </button>
            <button type="button" onClick={() => auth.resendOTP(form.email)} className="text-sm text-zinc-400 hover:underline w-full text-center">
              Resend code
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Create your account</h1>
        <p className="text-zinc-400 text-sm mb-8">Start writing on Lumea today</p>
        <form onSubmit={handleRegister} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">First name</label>
              <input required value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Last name</label>
              <input required value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">@</span>
              <input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                className="w-full border border-zinc-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Password</label>
            <input type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-zinc-900 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
