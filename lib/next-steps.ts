import { visiblePlans } from "@/lib/kt/service";
import { ktTasks } from "@/lib/servicenow/kt";
import { visibleDocuments, visibleRequests } from "@/lib/views";
import { generatedDocuments } from "@/lib/servicenow/documents";
import { daysBetween, today } from "@/lib/kt/template";
import type { SessionUser } from "@/types";

export interface NextStep {
  title: string;
  detail: string;
  href: string;
  /** Lower = more urgent. */
  urgency: number;
  tone: "red" | "amber" | "blue" | "purple" | "green";
}

const dueText = (due: string, t: string) => {
  const d = daysBetween(t, due);
  return d < 0 ? `${-d} day(s) overdue` : d === 0 ? "due today" : `due in ${d} day(s)`;
};

/**
 * What this person should do next, across exit handovers and module handovers.
 * `area` decides which portal the links open in.
 */
export async function nextSteps(user: SessionUser, area: "employee" | "admin"): Promise<NextStep[]> {
  const t = today();
  const steps: NextStep[] = [];
  const plans = (await visiblePlans(user)).filter((p) => p.status === "active");

  for (const p of plans) {
    const role = p.employeeId === user.id ? "leaver" : p.successorId === user.id ? "successor" : p.managerId === user.id ? "manager" : "admin";
    if (area === "employee" && role === "admin") continue;
    if (area === "admin" && role !== "admin" && role !== "manager") continue;
    const href = `/${area}/kt-plans/${p.id}`;
    const tasks = await ktTasks.all({ where: { planId: p.id } }, 500);
    const open = tasks.filter((x) => x.status !== "done");

    if (role === "leaver" || role === "successor" || role === "manager") {
      const mine = open.filter((x) => x.owner === role).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const next = mine[0];
      if (next) {
        const overdue = next.dueDate < t;
        steps.push({
          title: next.title,
          detail: `Exit handover · ${dueText(next.dueDate, t)}${mine.length > 1 ? ` · ${mine.length - 1} more task(s) for you` : ""}`,
          href: role === "leaver" && next.requestId ? `/employee/new-request?id=${next.requestId}` : href,
          urgency: overdue ? 0 : daysBetween(t, next.dueDate),
          tone: overdue ? "red" : daysBetween(t, next.dueDate) <= 3 ? "amber" : "blue",
        });
      }
    }
    if (role === "successor" && !p.successorSignedAt && open.length === 0) {
      steps.push({ title: "Confirm the handover you received", detail: "All tasks are done. Click “I received the knowledge” on the plan.", href, urgency: 1, tone: "purple" });
    }
    if ((role === "manager" || role === "admin") && p.successorSignedAt && !p.managerSignedAt) {
      steps.push({ title: "Give final sign-off", detail: "The successor has confirmed the handover.", href, urgency: 1, tone: "purple" });
    }
    if (role === "admin") {
      const overdue = open.filter((x) => x.dueDate < t).length;
      const daysLeft = daysBetween(t, p.lastWorkingDay);
      if (overdue > 0 || daysLeft <= 7) {
        steps.push({
          title: `Check the exit handover (${daysLeft < 0 ? "past last day" : `${daysLeft} days left`})`,
          detail: `${overdue} overdue task(s), ${open.length} open in total.`,
          href,
          urgency: overdue ? 2 : 5,
          tone: daysLeft <= 7 ? "red" : "amber",
        });
      }
    }
  }

  if (area === "employee") {
    const [reqs, docs] = await Promise.all([visibleRequests(user), visibleDocuments(user)]);
    const docByReq = new Map(docs.map((d) => [d.requestId, d]));
    for (const d of docs.filter((x) => x.authorId === user.id && (x.state === "changes_requested" || x.state === "rejected"))) {
      steps.push({ title: `Update “${d.title}”`, detail: "Your reviewer asked for changes. Read the comments, edit and resubmit.", href: `/employee/documents/${d.id}`, urgency: 1, tone: "amber" });
    }
    for (const d of docs.filter((x) => x.authorId === user.id && x.state === "ai_generated")) {
      steps.push({ title: `Review and submit “${d.title}”`, detail: "The AI draft is ready. Check it, edit if needed, then submit for approval.", href: `/employee/documents/${d.id}`, urgency: 4, tone: "blue" });
    }
    for (const r of reqs.filter((x) => x.requestedBy === user.id && !docByReq.has(x.id))) {
      steps.push({ title: `Fill in “${r.title}”`, detail: "Add the module details, then click Generate documentation.", href: `/employee/new-request?id=${r.id}`, urgency: 6, tone: "blue" });
    }
  } else {
    const pending = await generatedDocuments.list({ where: { state: "under_review" }, limit: 1 });
    if (pending.total > 0) {
      steps.push({ title: `${pending.total} document(s) waiting for your approval`, detail: "Open Approvals to review, approve or request changes.", href: "/admin/approvals", urgency: 3, tone: "amber" });
    }
  }

  // De-duplicate by title+href and keep the most urgent first.
  const seen = new Set<string>();
  return steps
    .sort((a, b) => a.urgency - b.urgency)
    .filter((s) => (seen.has(s.title + s.href) ? false : (seen.add(s.title + s.href), true)))
    .slice(0, 6);
}
