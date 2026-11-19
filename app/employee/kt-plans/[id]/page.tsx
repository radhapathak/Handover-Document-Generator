import { PlanDetail } from "@/components/kt/plan-detail";

export default async function KtPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanDetail id={id} area="employee" />;
}
