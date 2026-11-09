import { route, parseBody } from "@/lib/api/handler";
import { HttpError } from "@/lib/api/errors";
import { projects, moduleConfigurations } from "@/lib/servicenow/projects";
import { documentRequests } from "@/lib/servicenow/documents";
import { templates } from "@/lib/servicenow/templates";
import { requestInput } from "@/lib/validation/schemas";
import { nameMaps, visibleDocuments, visibleRequests } from "@/lib/views";
import { audit } from "@/lib/audit";

export const GET = route("user", async ({ user }) => {
  const [reqs, docs, names] = await Promise.all([visibleRequests(user), visibleDocuments(user), nameMaps()]);
  const docByReq = new Map(docs.map((d) => [d.requestId, d]));
  return {
    items: reqs.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      documentType: r.documentType,
      state: r.state,
      projectId: r.projectId,
      projectName: names.project.get(r.projectId) || "",
      requestedBy: r.requestedBy,
      requestedByName: names.person.get(r.requestedBy) || "",
      documentId: docByReq.get(r.id)?.id || "",
      documentState: docByReq.get(r.id)?.state || "",
      createdAt: r.createdAt,
    })),
  };
});

export const POST = route("user", async ({ req, user }) => {
  const data = await parseBody(req, requestInput);
  let projectId: string;
  if ("existingId" in data.project) {
    projectId = (await projects.getOrThrow(data.project.existingId)).id;
  } else {
    projectId = (await projects.create({ ...data.project.create, ownerId: user.id })).id;
  }
  if (data.templateId) {
    const t = await templates.get(data.templateId);
    if (!t || !t.active) throw new HttpError(400, "Selected template is not available.");
  }
  const module = await moduleConfigurations.create({
    projectId,
    moduleName: data.moduleName,
    moduleOwner: data.moduleOwner,
    businessDepartment: data.businessDepartment,
    documentType: data.documentType,
    description: data.description,
    config: data.config,
  });
  const request = await documentRequests.create({
    projectId,
    moduleConfigId: module.id,
    requestedBy: user.id,
    title: `${data.moduleName} — ${data.documentType}`,
    documentType: data.documentType,
    templateId: data.templateId || "",
    state: "open",
    referenceText: "",
  });
  audit("request.created", { user: user.id, requestId: request.id, projectId });
  return { item: request };
});
