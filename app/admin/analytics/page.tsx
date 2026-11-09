import { PageHeader } from "@/components/shared/ui";
import { AdminInsights } from "@/components/dashboard/admin-insights";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Productivity Analytics" crumbs={[{ label: "Admin Portal", href: "/admin/dashboard" }, { label: "Analytics" }]} subtitle="Hours saved are estimates: each template’s manual-effort baseline minus AI generation time and a review allowance." />
      <AdminInsights mode="analytics" />
    </>
  );
}
