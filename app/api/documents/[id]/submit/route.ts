import { z } from "zod";
import { route, parseBody } from "@/lib/api/handler";
import { submitDocument } from "@/lib/documents/service";
import { id as idSchema } from "@/lib/validation/schemas";

export const POST = route<{ id: string }>("user", async ({ req, user, params }) => {
  const { comments } = await parseBody(req, z.object({ comments: z.string().trim().max(4000).optional().default("") }));
  return { document: await submitDocument(user, idSchema.parse(params.id), comments) };
});
