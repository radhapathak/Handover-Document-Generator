import { documentApprovals } from "@/lib/servicenow/approvals";
import { aiLogs } from "@/lib/servicenow/logs";
import { documentRequests } from "@/lib/servicenow/documents";
import { moduleConfigurations } from "@/lib/servicenow/projects";
import { templates } from "@/lib/servicenow/templates";
import { nameMaps, visibleDocuments, visibleRequests, docSummary } from "@/lib/views";
import type { GeneratedDocument, SessionUser } from "@/types";

const APPROVED = ["approved", "published"];
const DRAFTISH = ["draft", "ai_generated", "changes_requested", "rejected"];
const REVIEW_HOURS = Number(process.env.REVIEW_EFFORT_HOURS || 1);

function monthKey(iso: string) {
  return iso ? iso.slice(0, 7) : "";
}
function lastMonths(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(x.toISOString().slice(0, 7));
  }
  return out;
}

export async function employeeDashboard(user: SessionUser) {
  const [docs, reqs, names] = await Promise.all([visibleDocuments(user), visibleRequests(user), nameMaps()]);
  const projectIds = new Set([...reqs.map((r) => r.projectId), ...names.projects.filter((p) => p.ownerId === user.id).map((p) => p.id)].filter(Boolean));
  const docByReq = new Map(docs.map((d) => [d.requestId, d]));
  const draftRequests = reqs.filter((r) => !docByReq.has(r.id)).length;
  return {
    kpis: {
      myProjects: projectIds.size,
      documentsGenerated: docs.length,
      draftDocuments: docs.filter((d) => DRAFTISH.includes(d.state)).length + draftRequests,
      pendingApprovals: docs.filter((d) => d.state === "under_review").length,
      approvedDocuments: docs.filter((d) => APPROVED.includes(d.state)).length,
      hoursSaved: round(docs.filter((d) => d.submittedAt).reduce((s, d) => s + (d.estimatedHoursSaved || 0), 0)),
    },
    recentRequests: reqs.slice(0, 6).map((r) => ({
      id: r.id, number: r.number, title: r.title, projectName: names.project.get(r.projectId) || "", createdAt: r.createdAt,
      documentId: docByReq.get(r.id)?.id || "", documentState: docByReq.get(r.id)?.state || "",
    })),
    recentDocuments: docs.slice(0, 6).map((d) => docSummary(d, names)),
    projectProgress: [...projectIds].map((pid) => {
      const pd = docs.filter((d) => d.projectId === pid);
      const pr = reqs.filter((r) => r.projectId === pid);
      const total = Math.max(pr.length, pd.length);
      const done = pd.filter((d) => APPROVED.includes(d.state)).length;
      return { projectId: pid, projectName: names.project.get(pid) || "Unknown", total, approved: done, percent: total ? Math.round((done / total) * 100) : 0 };
    }),
  };
}

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  projectId?: string;
  employeeId?: string;
  module?: string;
  state?: string;
}

export async function adminAnalytics(user: SessionUser, f: AnalyticsFilters) {
  const [allDocs, names, reqs, modules, approvals, logs, tpls] = await Promise.all([
    visibleDocuments(user),
    nameMaps(),
    documentRequests.all({}, 2000),
    moduleConfigurations.all({}, 2000),
    documentApprovals.all({}, 3000),
    aiLogs.list({ limit: 200 }),
    templates.all({}, 200),
  ]);
  const reqMap = new Map(reqs.map((r) => [r.id, r]));
  const modMap = new Map(modules.map((m) => [m.id, m]));
  const tplMap = new Map(tpls.map((t) => [t.id, t]));
  const moduleOf = (d: GeneratedDocument) => modMap.get(reqMap.get(d.requestId)?.moduleConfigId || "")?.moduleName || "";
  const manualOf = (d: GeneratedDocument) => tplMap.get(reqMap.get(d.requestId)?.templateId || "")?.manualEffortHours ?? 16;

  const docs = allDocs.filter((d) => {
    const day = d.createdAt.slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (f.projectId && d.projectId !== f.projectId) return false;
    if (f.employeeId && d.authorId !== f.employeeId) return false;
    if (f.module && moduleOf(d) !== f.module) return false;
    if (f.state && d.state !== f.state) return false;
    return true;
  });

  const months = lastMonths(12);
  const byMonth = months.map((m) => {
    const md = docs.filter((d) => monthKey(d.createdAt) === m);
    const approvedInMonth = docs.filter((d) => d.approvedAt && d.submittedAt && monthKey(d.approvedAt) === m);
    const turnaround = approvedInMonth.length
      ? approvedInMonth.reduce((s, d) => s + (new Date(d.approvedAt).getTime() - new Date(d.submittedAt).getTime()) / 86400000, 0) / approvedInMonth.length
      : null;
    return {
      month: m,
      generated: md.length,
      manualHours: round(md.reduce((s, d) => s + manualOf(d), 0)),
      aiHours: round(md.reduce((s, d) => s + d.generationSeconds / 3600 + REVIEW_HOURS, 0)),
      turnaroundDays: turnaround === null ? null : round(turnaround),
    };
  });

  const count = <K extends string>(arr: K[]) => arr.reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] || 0) + 1), a), {});
  const byProject = Object.entries(count(docs.map((d) => d.projectId))).map(([id, n]) => ({ name: names.project.get(id) || "Unknown", value: n }));
  const byAuthor = Object.entries(count(docs.map((d) => d.authorId))).map(([id, n]) => ({ name: names.person.get(id) || "Unknown", value: n }));
  const states = count(docs.map((d) => d.state));

  const docIds = new Set(docs.map((d) => d.id));
  const activity = [
    ...approvals.filter((a) => docIds.has(a.documentId)).map((a) => ({
      at: a.createdAt, actor: names.person.get(a.actorId) || "Unknown", action: a.action, documentId: a.documentId,
      title: docs.find((d) => d.id === a.documentId)?.title || "", comments: a.comments,
    })),
    ...logs.items.filter((l) => l.status === "success" && l.operation === "generate-document" || l.status === "error").map((l) => ({
      at: l.createdAt, actor: names.person.get(l.userId) || "Unknown", action: l.status === "error" ? "ai_error" : "ai_generated", documentId: l.documentId,
      title: allDocs.find((d) => d.id === l.documentId)?.title || "", comments: l.errorMessage,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);

  return {
    kpis: {
      totalEmployees: names.people.filter((p) => p.active).length,
      totalProjects: names.projects.length,
      totalModules: modules.length,
      documentsGenerated: docs.length,
      pendingReviews: docs.filter((d) => d.state === "under_review").length,
      approvedDocuments: docs.filter((d) => APPROVED.includes(d.state)).length,
      hoursSaved: round(docs.filter((d) => d.submittedAt).reduce((s, d) => s + (d.estimatedHoursSaved || 0), 0)),
    },
    charts: {
      byMonth,
      byProject,
      byAuthor,
      pendingVsApproved: [
        { name: "Draft / AI Generated", value: (states.draft || 0) + (states.ai_generated || 0) },
        { name: "Under Review", value: states.under_review || 0 },
        { name: "Changes Requested", value: (states.changes_requested || 0) + (states.rejected || 0) },
        { name: "Approved / Published", value: (states.approved || 0) + (states.published || 0) },
      ],
    },
    pending: docs.filter((d) => d.state === "under_review").map((d) => docSummary(d, names)),
    activity,
    filterOptions: {
      projects: names.projects.map((p) => ({ id: p.id, name: p.name })),
      employees: names.people.map((p) => ({ id: p.id, name: p.fullName })),
      modules: [...new Set(modules.map((m) => m.moduleName))].sort(),
    },
    assumptions: { reviewHours: REVIEW_HOURS },
  };
}

const round = (n: number) => Math.round(n * 10) / 10;
