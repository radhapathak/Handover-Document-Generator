import { route, parseBody } from "@/lib/api/handler";
import { reviewDocument } from "@/lib/documents/service";
import { reviewInput, id as idSchema } from "@/lib/validation/schemas";

export const POST = route<{ id: string }>("admin", async ({ req, user, params }) => {
  const { action, comments } = await parseBody(req, reviewInput);
  return { document: await reviewDocument(user, idSchema.parse(params.id), action, comments) };
});
