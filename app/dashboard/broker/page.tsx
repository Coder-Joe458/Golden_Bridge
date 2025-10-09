import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { BrokerProfileForm } from "@/components/broker/profile-form";

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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <BrokerProfileForm />
      </div>
    </main>
  );
}
