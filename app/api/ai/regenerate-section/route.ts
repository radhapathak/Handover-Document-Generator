import { z } from "zod";
import { route, parseBody } from "@/lib/api/handler";
import { HttpError } from "@/lib/api/errors";
import { aiPreflight, editableDocContext } from "@/lib/ai/route-helpers";
import { regenerateSection } from "@/lib/ai/pipeline";
import { generatedDocuments } from "@/lib/servicenow/documents";
import { id } from "@/lib/validation/schemas";

export const maxDuration = 120;

export const POST = route("user", async ({ req, user }) => {
  const body = await parseBody(req, z.object({ documentId: id, sectionKey: z.string().regex(/^[a-z_]{2,60}$/), instructions: z.string().trim().max(2000).optional().default("") }));
  aiPreflight(user);
  const { doc, context } = await editableDocContext(user, body.documentId);
  const current = doc.content.sections.find((s) => s.key === body.sectionKey);
  if (!current) throw new HttpError(404, "Section not found in this document.");
  const section = await regenerateSection({ userId: user.id, documentId: doc.id, requestId: doc.requestId, operation: "regenerate-section" }, context, body.sectionKey, current.html, body.instructions);
  const sections = doc.content.sections.map((s) => (s.key === section.key ? section : s));
  await generatedDocuments.update(doc.id, { content: { sections } });
  return { section };
});
