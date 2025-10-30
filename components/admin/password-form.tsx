"use client";

import { useState } from "react";
import clsx from "clsx";

type Locale = "en" | "zh";

type PasswordFormProps = {
  locale: Locale;
};

export function AdminPasswordForm({ locale }: PasswordFormProps) {
  const t = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setError(t("Passwords do not match", "两次密码输入不一致"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to reset password");
      }

      setStatus(t("Password updated successfully", "密码已更新"));
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Unable to reset password", "无法重置密码"));
    } finally {
      setLoading(false);
    }
  };

  const formDisabled = loading || !currentPassword || !newPassword || !confirmPassword;

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
      <header className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("Security", "安全设置")}</h2>
          <p className="text-sm text-slate-400">
            {t("Update the administrator password for enhanced account protection.", "可在此更新管理员密码，增强账户安全。")}
          </p>
        </div>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {status && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{status}</p>}

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          {t("Current password", "当前密码")}
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 focus:border-brand-primary focus:outline-none"
            required
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            {t("New password", "新密码")}
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 focus:border-brand-primary focus:outline-none"
              required
            />
            <span className="text-xs text-slate-500">
              {t("At least 12 characters, mixed case and symbols recommended.", "建议至少 12 个字符，并包含大小写与符号。")}
            </span>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            {t("Confirm password", "确认新密码")}
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 focus:border-brand-primary focus:outline-none"
              required
            />
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={resetForm}
            className={clsx(
              "rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:text-white",
              loading && "opacity-60"
            )}
            disabled={loading}
          >
            {t("Clear", "清空")}
          </button>
          <button
            type="submit"
            className="rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-brand-dark shadow-lg shadow-brand-primary/40 transition hover:-translate-y-0.5 disabled:opacity-60"
            disabled={formDisabled}
          >
            {loading ? t("Saving...", "提交中...") : t("Update password", "更新密码")}
          </button>
        </div>
      </form>
    </section>
  );
}

