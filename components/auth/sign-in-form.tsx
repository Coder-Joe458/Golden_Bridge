"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: "/"
    });

    setLoading(false);

    if (response?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-2xl shadow-black/20">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Welcome back</h1>
          <p className="text-sm text-slate-400">
            Sign in to continue orchestrating borrower journeys with Golden Bridge.
          </p>
        </div>
        {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
              placeholder="you@company.com"
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
          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-dark transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Securing your session..." : "Sign in"}
          </button>
        </form>
        <p className="text-sm text-slate-400">
          New to Golden Bridge? <a href="/signup" className="text-brand-primary">Create an account</a>
        </p>
      </div>
    </div>
  );
}
