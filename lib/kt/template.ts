import type { KtOwner } from "@/types";

/**
 * Default notice-period knowledge-transfer plan. Each step is placed at a fraction of the
 * notice period, so a 30-day notice gives roughly one week per phase and a 60-day notice
 * spreads the same steps out. HR can add, edit or remove tasks afterwards.
 */
export interface TemplateTask {
  title: string;
  description: string;
  owner: KtOwner;
  week: number;
  /** Due date as a fraction of the notice period (0 = start, 1 = last working day). */
  at: number;
  /** Per-module tasks are repeated for every module and linked to its handover document. */
  perModule?: "document" | "walkthrough";
}

export const KT_TEMPLATE: TemplateTask[] = [
  { week: 1, at: 0.1, owner: "leaver", title: "List all modules, projects and recurring duties", description: "Inventory everything you own: modules, scheduled jobs, reports, integrations, open tickets and recurring meetings." },
  { week: 1, at: 0.15, owner: "manager", title: "Grant the successor access", description: "Give the successor the same roles, groups, repositories and tool access needed for the handover." },
  { week: 1, at: 0.25, owner: "leaver", title: "Introduce the successor to key stakeholders and vendors", description: "Share contacts and introduce the successor in the relevant channels and meetings." },
  { week: 2, at: 0.5, owner: "leaver", title: "Write and submit the KT document", description: "Fill in the module configuration, generate the document with AI, review it and submit it for approval.", perModule: "document" },
  { week: 2, at: 0.5, owner: "leaver", title: "Document open issues, pending changes and known risks", description: "List anything in progress or fragile, with ticket numbers and next steps." },
  { week: 3, at: 0.7, owner: "leaver", title: "Walkthrough session", description: "Walk the successor through the module using the approved KT document and the workflow diagram.", perModule: "walkthrough" },
  { week: 3, at: 0.75, owner: "successor", title: "Shadow daily and weekly operational tasks", description: "Observe how support tickets, approvals and scheduled activities are handled." },
  { week: 4, at: 0.9, owner: "successor", title: "Handle the work independently (reverse shadowing)", description: "The successor does the work while the leaver observes and answers questions." },
  { week: 4, at: 1, owner: "manager", title: "Collect assets and remove access on the last working day", description: "Return laptop and badges, revoke the leaver's access, and reassign any remaining tickets." },
];

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000);
}

export interface PlannedTask {
  title: string;
  description: string;
  owner: KtOwner;
  week: number;
  dueDate: string;
  moduleIndex?: number;
}

/** Expands the template for a notice period and a list of module names. */
export function buildPlanTasks(noticeStart: string, lastWorkingDay: string, modules: string[]): PlannedTask[] {
  const length = Math.max(1, daysBetween(noticeStart, lastWorkingDay));
  const out: PlannedTask[] = [];
  for (const t of KT_TEMPLATE) {
    const dueDate = addDays(noticeStart, Math.min(length, Math.max(1, Math.round(length * t.at))));
    if (t.perModule) {
      modules.forEach((m, i) => out.push({ title: `${t.title}: ${m}`, description: t.description, owner: t.owner, week: t.week, dueDate, moduleIndex: i }));
    } else {
      out.push({ title: t.title, description: t.description, owner: t.owner, week: t.week, dueDate });
    }
  }
  return out;
}

export type Risk = "low" | "medium" | "high";

/** Progress, countdown and risk for a plan. `today` is YYYY-MM-DD. */
export function planProgress(
  plan: { lastWorkingDay: string; status: string },
  tasks: { status: string; dueDate: string }[],
  today: string
) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const daysLeft = daysBetween(today, plan.lastWorkingDay);
  const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;
  let risk: Risk = "low";
  if (plan.status === "active") {
    if ((daysLeft <= 7 && percent < 70) || daysLeft < 0) risk = "high";
    else if (overdue > 0) risk = "medium";
  }
  return { total, done, percent, daysLeft, overdue, risk };
}

export const today = () => new Date().toISOString().slice(0, 10);
