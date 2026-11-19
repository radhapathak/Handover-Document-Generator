import { route, parseBody } from "@/lib/api/handler";
import { HttpError } from "@/lib/api/errors";
import { loadPlan, planBundle } from "@/lib/kt/service";
import { ktPlans } from "@/lib/servicenow/kt";
import { ktPlanPatch, id as idSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit";

export const GET = route<{ id: string }>("user", async ({ user, params }) => planBundle(user, idSchema.parse(params.id)));

export const PATCH = route<{ id: string }>("user", async ({ req, user, params }) => {
  const { plan, role } = await loadPlan(user, idSchema.parse(params.id));
  if (role !== "admin" && role !== "manager") throw new HttpError(403, "Only HR or the manager can change the plan.");
  const data = await parseBody(req, ktPlanPatch);
  if (data.lastWorkingDay && data.lastWorkingDay <= plan.noticeStart) throw new HttpError(400, "Last working day must be after the notice start date.");
  const saved = await ktPlans.update(plan.id, data);
  audit("kt.plan.updated", { user: user.id, planId: plan.id, changes: Object.keys(data) });
  return { item: saved };
});
