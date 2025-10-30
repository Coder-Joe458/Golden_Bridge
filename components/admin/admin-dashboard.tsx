"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { AdminDealCasesManager } from "@/components/admin/deal-cases-manager";
import { AdminBrokersManager } from "@/components/admin/brokers-manager";
import { AdminPasswordForm } from "@/components/admin/password-form";

const tabs = [
  { id: "cases", label: "Deal Cases" },
  { id: "brokers", label: "Brokers" }
] as const;

type TabId = (typeof tabs)[number]["id"];
type Locale = "en" | "zh";

const resolveInitialLocale = (): Locale => {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("admin-dashboard-locale");
  if (stored === "zh" || stored === "en") return stored;
  if (window.navigator?.language?.toLowerCase().startsWith("zh")) {
    return "zh";
  }
  return "en";
};

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("cases");
  const [locale, setLocale] = useState<Locale>(() => (typeof window === "undefined" ? "en" : resolveInitialLocale()));

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLocale(resolveInitialLocale());
  }, []);

  const handleLocaleChange = (code: Locale) => {
    setLocale(code);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("admin-dashboard-locale", code);
    }
  };

  const t = (en: string, zh: string) => (locale === "zh" ? zh : en);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">{t("Admin Control Center", "后台控制中心")}</h1>
          <p className="text-sm text-slate-400">
            {t("Manage deal cases and partner brokers securely.", "安全维护成交案例及合作经纪人信息。")}
          </p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex gap-2 rounded-full border border-white/10 bg-slate-900/70 p-1">
            {(["en", "zh"] as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => handleLocaleChange(code)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  locale === code
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                )}
              >
                {code === "en" ? "EN" : "中文"}
              </button>
            ))}
          </div>
          <nav className="flex gap-2 rounded-full border border-white/10 bg-slate-900/70 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                )}
              >
                {locale === "zh" ? (tab.id === "cases" ? "成交案例" : "经纪人") : tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <AdminPasswordForm locale={locale} />

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
        {activeTab === "cases" ? (
          <AdminDealCasesManager locale={locale} />
        ) : (
          <AdminBrokersManager locale={locale} />
        )}
      </section>
    </div>
  );
}
