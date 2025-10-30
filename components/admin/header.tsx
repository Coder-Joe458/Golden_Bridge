"use client";

import Link from "next/link";

type AdminHeaderProps = {
  locale: "en" | "zh";
};

export function AdminHeader({ locale }: AdminHeaderProps) {
  const t = (en: string, zh: string) => (locale === "zh" ? zh : en);

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-6 border-b border-white/10 bg-slate-950/90 px-6 py-4 backdrop-blur-md md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("Admin Control Center", "后台控制中心")}</h1>
        <p className="text-sm text-slate-400">
          {t("Manage deal cases, broker partners, and keep your account secure.", "管理成交案例、合作经纪人并维护账户安全。")}
        </p>
      </div>
      <Link
        href="/admin/security"
        className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-brand-primary/60 hover:text-brand-primary"
      >
        {t("Security settings", "安全设置")}
      </Link>
    </header>
  );
}

