import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";

export type AdminSession = Session & { user: Session["user"] & { role: string } };

export async function requireAdminSession(): Promise<AdminSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return null;
  }
  return session as AdminSession;
}

