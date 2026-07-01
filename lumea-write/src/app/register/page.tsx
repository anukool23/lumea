"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user, token } = await api.register(form);
      setUser(user, token);
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { name: "name",     label: "Full name",  type: "text",     placeholder: "Anukool Patel",      autoComplete: "name" },
    { name: "username", label: "Username",   type: "text",     placeholder: "anukool",             autoComplete: "username" },
    { name: "email",    label: "Email",      type: "email",    placeholder: "you@example.com",     autoComplete: "email" },
    { name: "password", label: "Password",   type: "password", placeholder: "Min. 8 characters",  autoComplete: "new-password" },
  ] as const;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Join Lumea</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your writer account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor={f.name}>{f.label}</label>
              <input
                id={f.name}
                name={f.name}
                type={f.type}
                autoComplete={f.autoComplete}
                required
                value={form[f.name]}
                onChange={handleChange}
                placeholder={f.placeholder}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground h-9 px-4 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none mt-2"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
