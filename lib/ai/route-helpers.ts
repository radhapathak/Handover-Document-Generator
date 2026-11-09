import { config } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { HttpError } from "@/lib/api/errors";
import { isGroqConfigured } from "@/lib/ai/groq";
import { isEditable, STATE_LABELS } from "@/lib/documents/lifecycle";
import { loadDocument, loadGenerationContext } from "@/lib/documents/service";
import { buildContext } from "@/lib/ai/pipeline";
import type { SessionUser } from "@/types";

export function aiPreflight(user: SessionUser) {
  if (!isGroqConfigured()) throw new HttpError(503, "AI is not configured. An administrator must set GROQ_API_KEY (see GROQ_SETUP.md).");
  rateLimit(`ai:${user.id}`, config.limits.aiRequestsPerMinute);
}

/** Loads a document the user may edit, plus the AI context built from its request. */
export async function editableDocContext(user: SessionUser, documentId: string) {
  const doc = await loadDocument(user, documentId);
  if (!isEditable(doc.state)) throw new HttpError(409, `A document that is "${STATE_LABELS[doc.state]}" cannot be changed.`);
  if (doc.authorId !== user.id && user.role !== "admin") throw new HttpError(403, "Only the author can change this document.");
  const g = await loadGenerationContext({ ...user, role: "admin" }, doc.requestId); // access already checked via the document
  return { doc, context: buildContext(g) };
}
