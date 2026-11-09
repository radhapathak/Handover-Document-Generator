import { route, parseBody } from "@/lib/api/handler";
import { loadDocument, saveDocument } from "@/lib/documents/service";
import { documentApprovals } from "@/lib/servicenow/approvals";
import { documentRequests } from "@/lib/servicenow/documents";
import { moduleConfigurations, projects } from "@/lib/servicenow/projects";
import { employees } from "@/lib/servicenow/employees";
import { documentPatch, id as idSchema } from "@/lib/validation/schemas";
import { isEditable } from "@/lib/documents/lifecycle";

export const GET = route<{ id: string }>("user", async ({ user, params }) => {
  const doc = await loadDocument(user, idSchema.parse(params.id));
  const [request, project, approvals] = await Promise.all([
    documentRequests.get(doc.requestId),
    doc.projectId ? projects.get(doc.projectId) : null,
    documentApprovals.all({ where: { documentId: doc.id }, orderBy: "createdAt", desc: false }, 200),
  ]);
  const module = request ? await moduleConfigurations.get(request.moduleConfigId) : null;
  const ids = new Set([doc.authorId, ...approvals.map((a) => a.actorId)]);
  const people: Record<string, string> = {};
  await Promise.all([...ids].map(async (i) => (people[i] = (await employees.get(i))?.fullName || "Unknown")));
  return {
    document: doc,
    editable: isEditable(doc.state) && (doc.authorId === user.id || user.role === "admin"),
    isAuthor: doc.authorId === user.id,
    request: request ? { id: request.id, number: request.number, documentType: request.documentType } : null,
    module: module ? { id: module.id, moduleName: module.moduleName, moduleOwner: module.moduleOwner } : null,
    project: project ? { id: project.id, name: project.name } : null,
    approvals: approvals.map((a) => ({ ...a, actorName: people[a.actorId] || "Unknown" })),
    authorName: people[doc.authorId] || "",
  };
});

export const PATCH = route<{ id: string }>("user", async ({ req, user, params }) => {
  const patch = await parseBody(req, documentPatch);
  const doc = await saveDocument(user, idSchema.parse(params.id), patch);
  return { document: doc };
});
