import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminPasswordForm } from "@/components/admin/password-form";
import { authOptions } from "@/lib/auth";

export const metadata = {
  title: "Security Settings | Golden Bridge Admin"
};

const resolveInitialLocale = () => {
  if (typeof window === "undefined") return "en" as const;
  const stored = window.localStorage.getItem("admin-dashboard-locale");
  if (stored === "zh" || stored === "en") return stored;
  if (window.navigator?.language?.toLowerCase().startsWith("zh")) {
    return "zh" as const;
  }
  return "en" as const;
};

export default async function AdminSecurityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/signin");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
          <h1 className="text-2xl font-semibold text-white">Security Settings</h1>
          <p className="text-sm text-slate-400">Update your administrator password to keep the account secure.</p>
        </section>
        {/* Client component handles locale selection by reading localStorage */}
        <AdminSecurityClient />
      </div>
    </main>
  );
}

function AdminSecurityClient() {
  const locale = resolveInitialLocale();
  return <AdminPasswordForm locale={locale} />;
}

