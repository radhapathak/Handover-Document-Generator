import { route, parseBody } from "@/lib/api/handler";
import { projects } from "@/lib/servicenow/projects";
import { projectInput } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit";

export const GET = route("user", async () => ({ items: await projects.all({ orderBy: "name", desc: false }, 1000) }));

export const POST = route("user", async ({ req, user }) => {
  const data = await parseBody(req, projectInput);
  // Employees can add projects they own; only admins may assign another owner.
  const ownerId = user.role === "admin" && data.ownerId ? data.ownerId : user.id;
  const p = await projects.create({ ...data, ownerId });
  audit("project.created", { user: user.id, projectId: p.id });
  return { item: p };
});
