import { route, parseBody } from "@/lib/api/handler";
import { createPlan, visiblePlans } from "@/lib/kt/service";
import { ktTasks } from "@/lib/servicenow/kt";
import { planProgress, today } from "@/lib/kt/template";
import { nameMaps } from "@/lib/views";
import { ktPlanInput } from "@/lib/validation/schemas";

export const maxDuration = 60;

export const GET = route("user", async ({ user }) => {
  const [plans, names] = await Promise.all([visiblePlans(user), nameMaps()]);
  const t = today();
  const items = await Promise.all(
    plans.map(async (p) => {
      const tasks = await ktTasks.all({ where: { planId: p.id } }, 500);
      return {
        ...p,
        summary: undefined,
        employeeName: names.person.get(p.employeeId) || "Unknown",
        successorName: names.person.get(p.successorId) || "",
        managerName: names.person.get(p.managerId) || "",
        myRole: p.employeeId === user.id ? "leaver" : p.successorId === user.id ? "successor" : p.managerId === user.id ? "manager" : "admin",
        progress: planProgress(p, tasks, t),
      };
    })
  );
  return { items };
});

export const POST = route("admin", async ({ req, user }) => ({ item: await createPlan(user, await parseBody(req, ktPlanInput)) }));
