import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { BrokerProfileForm } from "@/components/broker/profile-form";
import { BrokerConversationCenter } from "@/components/broker/conversation-center";

export const metadata = {
  title: "Broker Dashboard | Golden Bridge Loan"
};

export default async function BrokerDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/signin");
  }

  if (session.user.role !== "BROKER" && session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section id="profile" className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
          <BrokerProfileForm />
        </section>
        <section id="leads">
          <BrokerConversationCenter />
        </section>
      </div>
    </main>
  );
}
