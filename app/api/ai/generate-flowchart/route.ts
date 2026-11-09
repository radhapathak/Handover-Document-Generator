import { z } from "zod";
import { route, parseBody } from "@/lib/api/handler";
import { aiPreflight, editableDocContext } from "@/lib/ai/route-helpers";
import { generateFlowchart } from "@/lib/ai/pipeline";
import { generatedDocuments } from "@/lib/servicenow/documents";
import { id } from "@/lib/validation/schemas";

export const maxDuration = 120;

export const POST = route("user", async ({ req, user }) => {
  // parseError: the browser's mermaid.parse() message, so the AI can repair its own diagram.
  const body = await parseBody(req, z.object({ documentId: id, parseError: z.string().max(2000).optional() }));
  aiPreflight(user);
  const { doc, context } = await editableDocContext(user, body.documentId);
  const previous = body.parseError && doc.mermaid ? { code: doc.mermaid, error: body.parseError } : undefined;
  const r = await generateFlowchart({ userId: user.id, documentId: doc.id, requestId: doc.requestId, operation: "generate-flowchart" }, context, previous);
  await generatedDocuments.update(doc.id, { mermaid: r.mermaid });
  return r;
});
