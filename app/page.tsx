import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  redirect(user ? (user.role === "admin" ? "/admin/dashboard" : "/employee/dashboard") : "/login");
}
