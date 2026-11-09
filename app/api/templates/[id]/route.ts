import { route, parseBody } from "@/lib/api/handler";
import { templates } from "@/lib/servicenow/templates";
import { templateInput, id as idSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit";

export const PATCH = route<{ id: string }>("admin", async ({ req, user, params }) => {
  const t = await templates.update(idSchema.parse(params.id), await parseBody(req, templateInput.partial()));
  audit("template.updated", { user: user.id, templateId: t.id });
  return { item: t };
});
