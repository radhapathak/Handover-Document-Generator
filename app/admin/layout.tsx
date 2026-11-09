import { pageUser } from "@/lib/auth/server-page";
import { config } from "@/lib/config";
import { AppShell } from "@/components/shared/app-shell";
import { SetupError } from "@/components/shared/setup-error";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const r = await pageUser(true);
  if ("error" in r) return <SetupError message={r.error} />;
  return <AppShell user={r.user} mode={config.dataMode}>{children}</AppShell>;
}
