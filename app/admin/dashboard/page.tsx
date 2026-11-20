import { PageHeader } from "@/components/shared/ui";
import { AdminInsights } from "@/components/dashboard/admin-insights";
import { KtBanner } from "@/components/kt/kt-banner";
import { NextSteps } from "@/components/dashboard/next-steps";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader title="Admin Dashboard" crumbs={[{ label: "Admin Portal" }, { label: "Dashboard" }]} subtitle="Documentation activity, reviews and productivity across the organisation." />
      <NextSteps area="admin" />
      <KtBanner area="admin" />
      <AdminInsights mode="dashboard" />
    </>
  );
}
