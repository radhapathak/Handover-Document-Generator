import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import type { SessionUser } from "@/types";

/** For server layouts: returns the user, or a setup/connection error message to display. */
export async function pageUser(requireAdmin = false): Promise<{ user: SessionUser } | { error: string }> {
  let user: SessionUser | null = null;
  try {
    user = await getCurrentUser();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  if (!user) redirect("/login");
  if (requireAdmin && user.role !== "admin") redirect("/employee/dashboard");
  return { user };
}
