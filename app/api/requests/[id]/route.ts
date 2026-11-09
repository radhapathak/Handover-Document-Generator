import { route, parseBody } from "@/lib/api/handler";
import { HttpError } from "@/lib/api/errors";
import { assertCanAccessRequest } from "@/lib/auth/guard";
import { projects, moduleConfigurations } from "@/lib/servicenow/projects";
import { documentRequests, requestAttachments } from "@/lib/servicenow/documents";
import { findDocumentForRequest } from "@/lib/documents/service";
import { isEditable } from "@/lib/documents/lifecycle";
import { requestUpdate, id as idSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit";

export const GET = route<{ id: string }>("user", async ({ user, params }) => {
  const request = await documentRequests.getOrThrow(idSchema.parse(params.id));
  assertCanAccessRequest(user, request);
  const [module, project, doc, attachments] = await Promise.all([
    moduleConfigurations.getOrThrow(request.moduleConfigId),
    request.projectId ? projects.get(request.projectId) : null,
    findDocumentForRequest(request.id),
    requestAttachments.list(request.id),
  ]);
  return {
    request: { ...request, referenceText: undefined, referenceChars: request.referenceText.length },
    module,
    project,
    document: doc ? { id: doc.id, state: doc.state } : null,
    attachments,
  };
});

export const PATCH = route<{ id: string }>("user", async ({ req, user, params }) => {
  const request = await documentRequests.getOrThrow(idSchema.parse(params.id));
  assertCanAccessRequest(user, request);
  const doc = await findDocumentForRequest(request.id);
  if (doc && !isEditable(doc.state)) throw new HttpError(409, "The document is under review or approved; its inputs can no longer be changed.");
  const data = await parseBody(req, requestUpdate);

  let projectId = request.projectId;
  if (data.project) {
    projectId = "existingId" in data.project ? (await projects.getOrThrow(data.project.existingId)).id : (await projects.create({ ...data.project.create, ownerId: user.id })).id;
  }
  await moduleConfigurations.update(request.moduleConfigId, {
    projectId,
    ...(data.moduleName !== undefined && { moduleName: data.moduleName }),
    ...(data.moduleOwner !== undefined && { moduleOwner: data.moduleOwner }),
    ...(data.businessDepartment !== undefined && { businessDepartment: data.businessDepartment }),
    ...(data.documentType !== undefined && { documentType: data.documentType }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.config !== undefined && { config: data.config }),
  });
  const updated = await documentRequests.update(request.id, {
    projectId,
    ...(data.moduleName && data.documentType && { title: `${data.moduleName} — ${data.documentType}` }),
    ...(data.documentType !== undefined && { documentType: data.documentType }),
    ...(data.templateId !== undefined && { templateId: data.templateId }),
  });
  audit("request.updated", { user: user.id, requestId: request.id });
  return { item: { ...updated, referenceText: undefined } };
});
