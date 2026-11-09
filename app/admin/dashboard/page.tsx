import { PageHeader } from "@/components/shared/ui";
import { AdminInsights } from "@/components/dashboard/admin-insights";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader title="Admin Dashboard" crumbs={[{ label: "Admin Portal" }, { label: "Dashboard" }]} subtitle="Documentation activity, reviews and productivity across the organisation." />
      <AdminInsights mode="dashboard" />
    </>
  );
}
