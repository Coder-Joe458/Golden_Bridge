"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const roles = [
  { value: "BORROWER", label: "Borrower (Consumer)" },
  { value: "BROKER", label: "Broker (Partner)" }
] as const;

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<typeof roles[number]["value"]>("BORROWER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, identifier, password, role })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Registration failed." }));
        throw new Error(body.error ?? "Registration failed.");
      }

      // Auto sign-in after registration for smooth onboarding
      await signIn("credentials", {
        redirect: false,
        identifier,
        password,
        callbackUrl: "/"
      });

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="w-full max-w-lg space-y-8 rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-2xl shadow-black/20">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Create your Golden Bridge account</h1>
          <p className="text-sm text-slate-400">
            Choose the workspace that fits you. Borrowers unlock AI-guided loan discovery; brokers receive curated matches.
          </p>
        </div>
        {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Full name
            <input
              required
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
              placeholder="Alex Morgan"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Work email or US phone
            <input
              required
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
              placeholder="you@company.com or +1 (555) 555-1234"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
              placeholder="Minimum 8 characters"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            I am joining as
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as typeof roles[number]["value"])}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value} className="text-slate-900">
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-dark transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Creating workspace..." : "Create account"}
          </button>
        </form>
        <p className="text-sm text-slate-400">
          Already onboarded? <a href="/signin" className="text-brand-primary">Sign in</a>
        </p>
      </div>
    </div>
  );
}
