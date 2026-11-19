import { route, parseBody } from "@/lib/api/handler";
import { deleteTask, updateTask } from "@/lib/kt/service";
import { ktTaskPatch, id as idSchema } from "@/lib/validation/schemas";

export const PATCH = route<{ id: string }>("user", async ({ req, user, params }) => ({
  item: await updateTask(user, idSchema.parse(params.id), await parseBody(req, ktTaskPatch)),
}));

export const DELETE = route<{ id: string }>("user", async ({ user, params }) => {
  await deleteTask(user, idSchema.parse(params.id));
  return { ok: true };
});
