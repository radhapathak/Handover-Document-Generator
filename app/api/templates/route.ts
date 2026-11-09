import { route, parseBody } from "@/lib/api/handler";
import { templates } from "@/lib/servicenow/templates";
import { templateInput } from "@/lib/validation/schemas";
import { AI_SECTIONS } from "@/lib/documents/sections";
import { audit } from "@/lib/audit";

export const GET = route("user", async ({ user }) => {
  const all = await templates.all({ orderBy: "name", desc: false }, 500);
  return { items: user.role === "admin" ? all : all.filter((t) => t.active), sections: AI_SECTIONS.map((s) => ({ key: s.key, title: s.title })) };
});

export const POST = route("admin", async ({ req, user }) => {
  const t = await templates.create(await parseBody(req, templateInput));
  audit("template.created", { user: user.id, templateId: t.id });
  return { item: t };
});
