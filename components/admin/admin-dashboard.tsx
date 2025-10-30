"use client";

import { useState } from "react";
import clsx from "clsx";
import { AdminDealCasesManager } from "@/components/admin/deal-cases-manager";
import { AdminBrokersManager } from "@/components/admin/brokers-manager";

const tabs = [
  { id: "cases", label: "Deal Cases" },
  { id: "brokers", label: "Brokers" }
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("cases");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Admin Control Center</h1>
          <p className="text-sm text-slate-400">Manage published deal cases and broker partner information securely.</p>
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
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
        {activeTab === "cases" ? <AdminDealCasesManager /> : <AdminBrokersManager />}
      </section>
    </div>
  );
}

