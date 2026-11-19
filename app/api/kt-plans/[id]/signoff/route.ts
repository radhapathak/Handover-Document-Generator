import { z } from "zod";
import { route, parseBody } from "@/lib/api/handler";
import { signOff } from "@/lib/kt/service";
import { id as idSchema } from "@/lib/validation/schemas";

export const POST = route<{ id: string }>("user", async ({ req, user, params }) => {
  const { as } = await parseBody(req, z.object({ as: z.enum(["successor", "manager"]) }));
  return { item: await signOff(user, idSchema.parse(params.id), as) };
});
