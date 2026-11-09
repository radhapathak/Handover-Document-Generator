import { route } from "@/lib/api/handler";
import { publishDocument } from "@/lib/documents/service";
import { id as idSchema } from "@/lib/validation/schemas";

export const POST = route<{ id: string }>("admin", async ({ user, params }) => ({ document: await publishDocument(user, idSchema.parse(params.id)) }));
