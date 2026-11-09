import { route, parseBody } from "@/lib/api/handler";
import { projects, moduleConfigurations } from "@/lib/servicenow/projects";
import { projectInput, id as idSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit";

export const GET = route<{ id: string }>("user", async ({ params }) => {
  const p = await projects.getOrThrow(idSchema.parse(params.id));
  const modules = await moduleConfigurations.all({ where: { projectId: p.id } }, 200);
  return { item: p, modules: modules.map((m) => ({ id: m.id, moduleName: m.moduleName, documentType: m.documentType, createdAt: m.createdAt })) };
});

export const PATCH = route<{ id: string }>("admin", async ({ req, user, params }) => {
  const data = await parseBody(req, projectInput.partial());
  const p = await projects.update(idSchema.parse(params.id), data);
  audit("project.updated", { user: user.id, projectId: p.id });
  return { item: p };
});
