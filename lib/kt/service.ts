import { HttpError } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { ktPlans, ktTasks } from "@/lib/servicenow/kt";
import { employees } from "@/lib/servicenow/employees";
import { documentRequests, generatedDocuments } from "@/lib/servicenow/documents";
import { moduleConfigurations, projects } from "@/lib/servicenow/projects";
import { templates } from "@/lib/servicenow/templates";
import { buildPlanTasks, planProgress, today } from "@/lib/kt/template";
import type { KtPlan, KtTask, SessionUser } from "@/types";

export type KtRole = "admin" | "leaver" | "successor" | "manager" | null;

/** How the user relates to a plan. Admins (HR) can see and manage every plan. */
export function ktRole(user: SessionUser, plan: KtPlan): KtRole {
  if (plan.employeeId === user.id) return "leaver";
  if (plan.successorId === user.id) return "successor";
  if (plan.managerId === user.id) return "manager";
  if (user.role === "admin") return "admin";
  return null;
}

export async function loadPlan(user: SessionUser, id: string) {
  const plan = await ktPlans.get(id);
  if (!plan) throw new HttpError(404, "KT plan not found.");
  const role = ktRole(user, plan);
  if (!role) throw new HttpError(404, "KT plan not found.");
  return { plan, role };
}

/** Plans the user takes part in (all plans for admins). */
export async function visiblePlans(user: SessionUser): Promise<KtPlan[]> {
  if (user.role === "admin") return ktPlans.all({}, 1000);
  const [a, b, c] = await Promise.all([
    ktPlans.all({ where: { employeeId: user.id } }, 200),
    ktPlans.all({ where: { successorId: user.id } }, 200),
    ktPlans.all({ where: { managerId: user.id } }, 200),
  ]);
  const map = new Map([...a, ...b, ...c].map((p) => [p.id, p]));
  return [...map.values()].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}

/** Successors and managers of a plan may read (not edit) the KT documents linked to it. */
export async function canReadViaKtPlan(userId: string, requestId: string): Promise<boolean> {
  const tasks = await ktTasks.all({ where: { requestId } }, 50);
  for (const t of tasks) {
    const p = await ktPlans.get(t.planId);
    if (p && (p.successorId === userId || p.managerId === userId)) return true;
  }
  return false;
}

export interface CreatePlanInput {
  employeeId: string;
  successorId?: string;
  managerId?: string;
  noticeStart: string;
  lastWorkingDay: string;
  notes?: string;
  modules: { moduleName: string; projectId: string }[];
}

/** Creates the plan, a handover request per module (owned by the leaver) and the task list. */
export async function createPlan(admin: SessionUser, input: CreatePlanInput) {
  if (input.lastWorkingDay <= input.noticeStart) throw new HttpError(400, "Last working day must be after the notice start date.");
  if (input.successorId && input.successorId === input.employeeId) throw new HttpError(400, "The successor must be a different person.");
  const leaver = await employees.get(input.employeeId);
  if (!leaver || !leaver.active) throw new HttpError(400, "Leaving employee not found or inactive.");
  for (const id of [input.successorId, input.managerId].filter(Boolean) as string[]) {
    if (!(await employees.get(id))) throw new HttpError(400, "Successor or manager not found.");
  }
  const existing = await ktPlans.list({ where: { employeeId: input.employeeId, status: "active" }, limit: 1 });
  if (existing.total > 0) throw new HttpError(409, `${leaver.fullName} already has an active KT plan.`);

  const plan = await ktPlans.create({
    employeeId: input.employeeId,
    successorId: input.successorId || "",
    managerId: input.managerId || "",
    noticeStart: input.noticeStart,
    lastWorkingDay: input.lastWorkingDay,
    status: "active",
    notes: input.notes || "",
  });

  const tpl = (await templates.all({ where: { active: "true" } }, 50))[0];
  const requestIds: string[] = [];
  for (const m of input.modules) {
    const project = await projects.getOrThrow(m.projectId);
    const mc = await moduleConfigurations.create({
      projectId: project.id,
      moduleName: m.moduleName,
      moduleOwner: leaver.fullName,
      businessDepartment: leaver.department,
      documentType: "Technical Handover",
      description: `Notice-period knowledge transfer from ${leaver.fullName}.`,
      config: {},
    });
    const req = await documentRequests.create({
      projectId: project.id,
      moduleConfigId: mc.id,
      requestedBy: leaver.id,
      title: `${m.moduleName} — Notice Period KT`,
      documentType: "Technical Handover",
      templateId: tpl?.id || "",
      state: "open",
      referenceText: "",
    });
    requestIds.push(req.id);
  }

  for (const t of buildPlanTasks(input.noticeStart, input.lastWorkingDay, input.modules.map((m) => m.moduleName))) {
    await ktTasks.create({
      planId: plan.id,
      title: t.title,
      description: t.description,
      owner: t.owner,
      week: t.week,
      dueDate: t.dueDate,
      status: "todo",
      requestId: t.moduleIndex !== undefined && t.title.startsWith("Write") ? requestIds[t.moduleIndex] : "",
    });
  }
  audit("kt.plan.created", { user: admin.id, planId: plan.id, employeeId: input.employeeId, modules: input.modules.length });
  return plan;
}

export async function planBundle(user: SessionUser, id: string) {
  const { plan, role } = await loadPlan(user, id);
  const tasks = (await ktTasks.all({ where: { planId: id }, orderBy: "dueDate", desc: false }, 500)).sort(
    (a, b) => a.week - b.week || a.dueDate.localeCompare(b.dueDate)
  );
  const ids = [plan.employeeId, plan.successorId, plan.managerId].filter(Boolean);
  const people: Record<string, string> = {};
  await Promise.all(ids.map(async (i) => (people[i] = (await employees.get(i))?.fullName || "Unknown")));

  const docs: Record<string, { id: string; state: string; title: string }> = {};
  for (const t of tasks.filter((x) => x.requestId)) {
    const { items } = await generatedDocuments.list({ where: { requestId: t.requestId }, limit: 1 });
    const req = await documentRequests.get(t.requestId);
    docs[t.requestId] = items[0] ? { id: items[0].id, state: items[0].state, title: items[0].title } : { id: "", state: "", title: req?.title || "" };
  }
  return { plan, role, tasks, people, docs, progress: planProgress(plan, tasks, today()) };
}

export async function updateTask(user: SessionUser, taskId: string, patch: Partial<Pick<KtTask, "status" | "title" | "description" | "dueDate" | "owner">>) {
  const task = await ktTasks.getOrThrow(taskId);
  const { plan, role } = await loadPlan(user, task.planId);
  if (plan.status !== "active") throw new HttpError(409, "This KT plan is closed.");
  const canEditDetails = role === "admin" || role === "manager";
  if ((patch.title || patch.description || patch.dueDate || patch.owner) && !canEditDetails) {
    throw new HttpError(403, "Only HR or the manager can change task details.");
  }
  if (patch.status && !(canEditDetails || role === "leaver" || role === "successor")) throw new HttpError(403, "Not allowed.");
  const update: Partial<KtTask> = { ...patch };
  if (patch.status) update.completedAt = patch.status === "done" ? new Date().toISOString() : "";
  const saved = await ktTasks.update(taskId, update);
  audit("kt.task.updated", { user: user.id, taskId, planId: plan.id, changes: Object.keys(patch) });
  return saved;
}

export async function addTask(user: SessionUser, planId: string, t: Pick<KtTask, "title" | "description" | "dueDate" | "owner" | "week">) {
  const { plan, role } = await loadPlan(user, planId);
  if (plan.status !== "active") throw new HttpError(409, "This KT plan is closed.");
  if (!["admin", "manager", "leaver"].includes(role || "")) throw new HttpError(403, "Not allowed to add tasks.");
  return ktTasks.create({ ...t, planId, status: "todo", requestId: "" });
}

export async function deleteTask(user: SessionUser, taskId: string) {
  const task = await ktTasks.getOrThrow(taskId);
  const { role } = await loadPlan(user, task.planId);
  if (role !== "admin" && role !== "manager") throw new HttpError(403, "Only HR or the manager can remove tasks.");
  await ktTasks.remove(taskId);
}

/** Successor confirms the handover; the manager (or HR) gives final sign-off, which completes the plan. */
export async function signOff(user: SessionUser, planId: string, as: "successor" | "manager") {
  const { plan, role } = await loadPlan(user, planId);
  if (plan.status !== "active") throw new HttpError(409, "This KT plan is already closed.");
  const now = new Date().toISOString();
  if (as === "successor") {
    if (role !== "successor") throw new HttpError(403, "Only the successor can confirm the handover.");
    const saved = await ktPlans.update(planId, { successorSignedAt: now });
    audit("kt.signoff.successor", { user: user.id, planId });
    return saved;
  }
  if (role !== "manager" && role !== "admin") throw new HttpError(403, "Only the manager or HR can give final sign-off.");
  if (plan.successorId && !plan.successorSignedAt) throw new HttpError(409, "The successor must confirm the handover first.");
  const saved = await ktPlans.update(planId, { managerSignedAt: now, status: "completed", completedAt: now });
  audit("kt.signoff.manager", { user: user.id, planId });
  return saved;
}
