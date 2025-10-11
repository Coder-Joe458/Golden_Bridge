"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

export type BrokerProfile = {
  company: string | null;
  headline: string | null;
  bio: string | null;
  licenseStates: string[];
  yearsExperience: number | null;
  website: string | null;
  minRate: number | null;
  maxRate: number | null;
  loanPrograms: string[];
  minCreditScore: number | null;
  maxLoanToValue: number | null;
  notes: string | null;
  closingSpeedDays: number | null;
};

const defaultProfile: BrokerProfile = {
  company: null,
  headline: null,
  bio: null,
  licenseStates: [],
  yearsExperience: null,
  website: null,
  minRate: null,
  maxRate: null,
  loanPrograms: [],
  minCreditScore: null,
  maxLoanToValue: null,
  notes: null,
  closingSpeedDays: null
};

export function BrokerProfileForm() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<BrokerProfile>(defaultProfile);
  const [formState, setFormState] = useState({
    company: "",
    headline: "",
    bio: "",
    licenseStates: "",
    yearsExperience: "",
    website: "",
    minRate: "",
    maxRate: "",
    loanPrograms: "",
    minCreditScore: "",
    maxLoanToValue: "",
    notes: "",
    closingSpeedDays: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/broker/profile", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error("Failed to load broker profile");
        }
        const data = (await response.json()) as { profile: BrokerProfile };
        setProfile(data.profile);
        setFormState({
          company: data.profile.company ?? "",
          headline: data.profile.headline ?? "",
          bio: data.profile.bio ?? "",
          licenseStates: (data.profile.licenseStates ?? []).join(", "),
          yearsExperience: data.profile.yearsExperience?.toString() ?? "",
          website: data.profile.website ?? "",
          minRate: data.profile.minRate?.toString() ?? "",
          maxRate: data.profile.maxRate?.toString() ?? "",
          loanPrograms: (data.profile.loanPrograms ?? []).join(", "),
          minCreditScore: data.profile.minCreditScore?.toString() ?? "",
          maxLoanToValue: data.profile.maxLoanToValue?.toString() ?? "",
          notes: data.profile.notes ?? "",
          closingSpeedDays: data.profile.closingSpeedDays?.toString() ?? ""
        });
      } catch (err) {
        console.error(err);
        setError("Unable to load broker profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    load().catch((err) => console.error(err));
  }, []);

  const hasChanges = useMemo(() => {
    if (!profile) return true;
    const normalizedStates = formState.licenseStates
      .split(",")
      .map((val) => val.trim().toUpperCase())
      .filter(Boolean)
      .sort();
    const originalStates = [...(profile.licenseStates ?? [])]
      .map((val) => val.toUpperCase())
      .sort();

    const normalizedPrograms = formState.loanPrograms
      .split(",")
      .map((val) => val.trim())
      .filter(Boolean)
      .sort();
    const originalPrograms = [...(profile.loanPrograms ?? [])].map((val) => val.trim()).filter(Boolean).sort();

    return (
      (profile.company ?? "") !== formState.company.trim() ||
      (profile.headline ?? "") !== formState.headline.trim() ||
      (profile.bio ?? "") !== formState.bio.trim() ||
      JSON.stringify(normalizedStates) !== JSON.stringify(originalStates) ||
      (profile.yearsExperience?.toString() ?? "") !== formState.yearsExperience.trim() ||
      (profile.website ?? "") !== formState.website.trim() ||
      (profile.minRate?.toString() ?? "") !== formState.minRate.trim() ||
      (profile.maxRate?.toString() ?? "") !== formState.maxRate.trim() ||
      JSON.stringify(normalizedPrograms) !== JSON.stringify(originalPrograms) ||
      (profile.minCreditScore?.toString() ?? "") !== formState.minCreditScore.trim() ||
      (profile.maxLoanToValue?.toString() ?? "") !== formState.maxLoanToValue.trim() ||
      (profile.notes ?? "") !== formState.notes.trim() ||
      (profile.closingSpeedDays?.toString() ?? "") !== formState.closingSpeedDays.trim()
    );
  }, [formState, profile]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = event.target;
    setFormState((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);

    const licenseStates = formState.licenseStates
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.toUpperCase());

    const loanPrograms = formState.loanPrograms
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const toOptionalString = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    };

    const toOptionalNumber = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed.length) return undefined;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const payload = {
      company: toOptionalString(formState.company),
      headline: toOptionalString(formState.headline),
      bio: toOptionalString(formState.bio),
      licenseStates,
      yearsExperience: toOptionalNumber(formState.yearsExperience)?.valueOf?.(),
      website: toOptionalString(formState.website),
      minRate: toOptionalNumber(formState.minRate),
      maxRate: toOptionalNumber(formState.maxRate),
      loanPrograms: loanPrograms.length ? loanPrograms : undefined,
      minCreditScore: toOptionalNumber(formState.minCreditScore),
      maxLoanToValue: toOptionalNumber(formState.maxLoanToValue),
      notes: toOptionalString(formState.notes),
      closingSpeedDays: toOptionalNumber(formState.closingSpeedDays)
    };

    try {
      const response = await fetch("/api/broker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Save failed" }));
        throw new Error(body.error ?? "Unable to save profile");
      }

      const data = (await response.json()) as { profile: BrokerProfile };
      setProfile(data.profile);
      setStatus("Profile saved successfully.");
      setFormState({
        company: data.profile.company ?? "",
        headline: data.profile.headline ?? "",
        bio: data.profile.bio ?? "",
        licenseStates: (data.profile.licenseStates ?? []).join(", "),
        yearsExperience: data.profile.yearsExperience?.toString() ?? "",
        website: data.profile.website ?? "",
        minRate: data.profile.minRate?.toString() ?? "",
        maxRate: data.profile.maxRate?.toString() ?? "",
        loanPrograms: (data.profile.loanPrograms ?? []).join(", "),
        minCreditScore: data.profile.minCreditScore?.toString() ?? "",
        maxLoanToValue: data.profile.maxLoanToValue?.toString() ?? "",
        notes: data.profile.notes ?? "",
        closingSpeedDays: data.profile.closingSpeedDays?.toString() ?? ""
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to save broker profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center text-slate-300 shadow-2xl shadow-black/20">
        Loading broker profile...
      </div>
    );
  }

  if (error && !profile && !hasChanges) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-10 text-center text-red-200 shadow-2xl shadow-black/20">
        {error}
      </div>
    );
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Broker Profile</h1>
        <p className="text-sm text-slate-400">
          Manage the details borrowers see when they explore your lending offerings. All updates are saved instantly to your Golden Bridge
          workspace.
        </p>
      </header>

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/20">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="company">
            Company name
            <input
              id="company"
              value={formState.company}
              onChange={handleChange}
              placeholder="Golden Bridge Lending Partners"
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="headline">
            Headline
            <input
              id="headline"
              value={formState.headline}
              onChange={handleChange}
              placeholder="Specialised in jumbo loans and relocation programs"
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
            />
          </label>
        </fieldset>

        <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="bio">
          Bio
          <textarea
            id="bio"
            rows={5}
            value={formState.bio}
            onChange={handleChange}
            placeholder="Share your lending expertise, key programmes and differentiators."
            className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
          />
        </label>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="licenseStates">
            Licensed states (comma separated)
            <input
              id="licenseStates"
              value={formState.licenseStates}
              onChange={handleChange}
              placeholder="CA, NY, WA"
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="yearsExperience">
            Years of experience
            <input
              id="yearsExperience"
              type="number"
              min={0}
              max={80}
              value={formState.yearsExperience}
              onChange={handleChange}
              placeholder="10"
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
            />
          </label>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="minRate">
            Introductory rate (from %)
            <input
              id="minRate"
              type="number"
              min={0}
              max={99}
              step="0.01"
              value={formState.minRate}
              onChange={handleChange}
              placeholder="5.50"
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="maxRate">
            Introductory rate (to %)
            <input
              id="maxRate"
              type="number"
              min={0}
              max={99}
              step="0.01"
              value={formState.maxRate}
              onChange={handleChange}
              placeholder="6.25"
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
            />
          </label>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="loanPrograms">
            Loan programmes offered (comma separated)
            <input
              id="loanPrograms"
              value={formState.loanPrograms}
              onChange={handleChange}
              placeholder="Jumbo, DSCR, Bank statement"
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="minCreditScore">
            Minimum credit score accepted
            <input
              id="minCreditScore"
              type="number"
              min={300}
              max={850}
              value={formState.minCreditScore}
              onChange={handleChange}
              placeholder="680"
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
            />
          </label>
        </fieldset>

        <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="maxLoanToValue">
          Maximum loan-to-value (%)
          <input
            id="maxLoanToValue"
            type="number"
            min={10}
            max={100}
            value={formState.maxLoanToValue}
            onChange={handleChange}
            placeholder="90"
            className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
          />
        </label>

        <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="closingSpeedDays">
          Average closing speed (days)
          <input
            id="closingSpeedDays"
            type="number"
            min={1}
            max={120}
            value={formState.closingSpeedDays}
            onChange={handleChange}
            placeholder="14"
            className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
          />
        </label>

        <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="website">
          Website
          <input
            id="website"
            type="url"
            value={formState.website}
            onChange={handleChange}
            placeholder="https://your-brokerage.com"
            className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
          />
        </label>

        <label className="flex flex-col gap-2 text-xs text-slate-300" htmlFor="notes">
          Additional notes
          <textarea
            id="notes"
            rows={4}
            value={formState.notes}
            onChange={handleChange}
            placeholder="Closing speed, documentation requirements, special programmes, etc."
            className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
          />
        </label>
      </section>

      {(status || error) && (
        <div
          className={`rounded-2xl border px-5 py-4 text-sm ${
            status
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/40 bg-red-500/10 text-red-200"
          }`}
        >
          {status ?? error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || !hasChanges}
          className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-dark transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
        {hasChanges && !saving && (
          <button
            type="button"
            onClick={() => {
              setFormState({
                company: profile.company ?? "",
                headline: profile.headline ?? "",
                bio: profile.bio ?? "",
                licenseStates: (profile.licenseStates ?? []).join(", "),
                yearsExperience: profile.yearsExperience?.toString() ?? "",
                website: profile.website ?? "",
                minRate: profile.minRate?.toString() ?? "",
                maxRate: profile.maxRate?.toString() ?? "",
                loanPrograms: (profile.loanPrograms ?? []).join(", "),
                minCreditScore: profile.minCreditScore?.toString() ?? "",
                maxLoanToValue: profile.maxLoanToValue?.toString() ?? "",
                notes: profile.notes ?? "",
                closingSpeedDays: profile.closingSpeedDays?.toString() ?? ""
              });
              setStatus(null);
              setError(null);
            }}
            className="rounded-full border border-white/15 px-6 py-3 text-sm text-slate-300 transition hover:border-brand-accent/60 hover:text-brand-accent"
          >
            Discard changes
          </button>
        )}
        <p className="text-xs text-slate-500">
          Signed in as {session?.user?.email}. Changes are visible immediately across Golden Bridge.
        </p>
      </div>
    </form>
  );
}
