import { z } from "zod";
import { route, parseBody } from "@/lib/api/handler";
import { aiPreflight } from "@/lib/ai/route-helpers";
import { generateDocument } from "@/lib/documents/service";
import { id } from "@/lib/validation/schemas";

export const maxDuration = 300;

export const POST = route("user", async ({ req, user }) => {
  const { requestId } = await parseBody(req, z.object({ requestId: id }));
  aiPreflight(user);
  const doc = await generateDocument(user, requestId);
  return { document: { id: doc.id, state: doc.state, generationSeconds: doc.generationSeconds } };
});
