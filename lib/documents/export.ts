import { documentApprovals } from "@/lib/servicenow/approvals";
import { documentRequests, documentVersions } from "@/lib/servicenow/documents";
import { employees } from "@/lib/servicenow/employees";
import { moduleConfigurations, projects } from "@/lib/servicenow/projects";
import { STATE_LABELS } from "@/lib/documents/lifecycle";
import { fmtDate, type ExportInput } from "@/lib/documents/export-types";
import type { GeneratedDocument } from "@/types";

export async function buildExportInput(doc: GeneratedDocument, diagram?: ExportInput["diagram"]): Promise<ExportInput> {
  const [request, project, versions, approvals] = await Promise.all([
    documentRequests.get(doc.requestId),
    doc.projectId ? projects.get(doc.projectId) : Promise.resolve(null),
    documentVersions.all({ where: { documentId: doc.id }, orderBy: "versionNumber", desc: false }, 200),
    documentApprovals.all({ where: { documentId: doc.id }, orderBy: "createdAt", desc: false }, 200),
  ]);
  const module = request ? await moduleConfigurations.get(request.moduleConfigId) : null;

  const peopleIds = new Set([doc.authorId, ...versions.map((v) => v.createdBy), ...approvals.map((a) => a.actorId)].filter(Boolean));
  const people = new Map<string, string>();
  await Promise.all([...peopleIds].map(async (id) => people.set(id, (await employees.get(id))?.fullName || "Unknown")));
  const approver = [...approvals].reverse().find((a) => a.action === "approved");

  return {
    title: doc.title,
    projectName: project?.name || "",
    projectCode: project?.projectCode || "",
    applicationName: project?.applicationName || "",
    moduleName: module?.moduleName || "",
    moduleOwner: module?.moduleOwner || "",
    department: module?.businessDepartment || project?.department || "",
    documentType: request?.documentType || "",
    requestNumber: request?.number || "",
    authorName: people.get(doc.authorId) || "",
    approverName: approver ? people.get(approver.actorId) || "" : "",
    stateLabel: STATE_LABELS[doc.state],
    version: doc.currentVersion,
    createdAt: doc.createdAt,
    approvedAt: doc.approvedAt,
    sections: doc.content?.sections || [],
    revisions: [
      ...versions.map((v) => ({ version: `v${v.versionNumber}`, date: fmtDate(v.createdAt), author: people.get(v.createdBy) || "", summary: v.changeSummary })),
      ...approvals.filter((a) => a.action !== "submitted").map((a) => ({ version: `v${a.versionNumber}`, date: fmtDate(a.createdAt), author: people.get(a.actorId) || "", summary: `${STATE_LABELS[a.action === "changes_requested" ? "changes_requested" : a.action === "comment" ? "under_review" : (a.action as "approved")] || a.action}${a.comments ? `: ${a.comments}` : ""}` })),
    ].sort((a, b) => a.date.localeCompare(b.date)),
    diagram,
    workflowSectionKey: "workflow_routing",
  };
}
