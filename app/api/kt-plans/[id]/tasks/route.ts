import { route, parseBody } from "@/lib/api/handler";
import { addTask } from "@/lib/kt/service";
import { ktTaskInput, id as idSchema } from "@/lib/validation/schemas";

export const POST = route<{ id: string }>("user", async ({ req, user, params }) => ({
  item: await addTask(user, idSchema.parse(params.id), await parseBody(req, ktTaskInput)),
}));
