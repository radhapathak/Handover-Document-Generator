import { z } from "zod";
import { route, parseBody } from "@/lib/api/handler";
import { aiPreflight } from "@/lib/ai/route-helpers";
import { chatText } from "@/lib/ai/groq";
import { BASE_RULES } from "@/lib/ai/prompts";
import { planBundle } from "@/lib/kt/service";
import { ktPlans } from "@/lib/servicenow/kt";
import { generatedDocuments } from "@/lib/servicenow/documents";
import { htmlToText, markdownToSafeHtml } from "@/lib/documents/html";
import { HttpError } from "@/lib/api/errors";
import { id } from "@/lib/validation/schemas";

export const maxDuration = 120;

/** AI "Exit KT Summary": one page the successor and manager can use as the handover cover note. */
export const POST = route("user", async ({ req, user }) => {
  const { planId } = await parseBody(req, z.object({ planId: id }));
  const b = await planBundle(user, planId);
  if (!["admin", "manager", "leaver"].includes(b.role || "")) throw new HttpError(403, "Not allowed.");
  aiPreflight(user);

  const docSummaries: string[] = [];
  for (const d of Object.values(b.docs)) {
    if (!d.id) {
      docSummaries.push(`- ${d.title}: Information Required (KT document not generated yet)`);
      continue;
    }
    const doc = await generatedDocuments.get(d.id);
    const first = doc?.content?.sections?.slice(0, 3).map((s) => `${s.title}: ${htmlToText(s.html)}`).join(" ").slice(0, 1200);
    docSummaries.push(`- ${d.title} (status ${d.state}): ${first}`);
  }
  const taskLines = b.tasks.map((t) => `- [${t.status}] week ${t.week}, due ${t.dueDate}, owner ${t.owner}: ${t.title}`).join("\n");
  const context = `NOTICE-PERIOD KT PLAN
Leaving employee: ${b.people[b.plan.employeeId]}
Successor: ${b.people[b.plan.successorId] || "Information Required"}
Manager: ${b.people[b.plan.managerId] || "Information Required"}
Notice period: ${b.plan.noticeStart} to ${b.plan.lastWorkingDay} (${b.progress.daysLeft} days left, ${b.progress.percent}% of tasks done, ${b.progress.overdue} overdue)
Notes: ${b.plan.notes || "none"}

TASKS:
${taskLines}

KT DOCUMENTS:
${docSummaries.join("\n")}`.slice(0, 9000);

  const md = await chatText(
    { userId: user.id, operation: "kt-summary" },
    [
      { role: "system", content: `${BASE_RULES.replace(/5\. HTML output[^\n]*/, "5. Answer in concise Markdown.")}\nTASK: Write an Exit Knowledge-Transfer Summary (max ~400 words) with headings: Overview, Modules handed over (status of each), Open items and risks, What the successor must do next, Sign-off status. Use only the plan data.` },
      { role: "user", content: context },
    ],
    1500
  );
  const html = await markdownToSafeHtml(md);
  await ktPlans.update(planId, { summary: html });
  return { html };
});
