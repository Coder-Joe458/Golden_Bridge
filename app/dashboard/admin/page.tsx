import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata = {
  title: "Admin Dashboard | Golden Bridge Loan"
};

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <AdminDashboard />
    </main>
  );
}

