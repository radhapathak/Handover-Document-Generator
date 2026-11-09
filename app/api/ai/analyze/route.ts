import { z } from "zod";
import { route, parseBody } from "@/lib/api/handler";
import { aiPreflight } from "@/lib/ai/route-helpers";
import { analyzeConfiguration, buildContext } from "@/lib/ai/pipeline";
import { loadGenerationContext, findDocumentForRequest } from "@/lib/documents/service";
import { generatedDocuments } from "@/lib/servicenow/documents";
import { isEditable } from "@/lib/documents/lifecycle";
import { id } from "@/lib/validation/schemas";

export const maxDuration = 60;

export const POST = route("user", async ({ req, user }) => {
  const { requestId } = await parseBody(req, z.object({ requestId: id }));
  aiPreflight(user);
  const g = await loadGenerationContext(user, requestId);
  const analysis = await analyzeConfiguration({ userId: user.id, requestId, operation: "analyze" }, buildContext(g));
  const doc = await findDocumentForRequest(requestId);
  if (doc && isEditable(doc.state)) await generatedDocuments.update(doc.id, { analysis });
  return { analysis };
});
