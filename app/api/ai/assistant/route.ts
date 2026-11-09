import { route, parseBody } from "@/lib/api/handler";
import { aiPreflight } from "@/lib/ai/route-helpers";
import { assistantReply, buildContext } from "@/lib/ai/pipeline";
import { loadDocument, loadGenerationContext } from "@/lib/documents/service";
import { htmlToText, markdownToSafeHtml } from "@/lib/documents/html";
import { chatInput } from "@/lib/validation/schemas";

export const maxDuration = 60;

export const POST = route("user", async ({ req, user }) => {
  const body = await parseBody(req, chatInput);
  aiPreflight(user);
  let context = "PROJECT CONTEXT: none selected. Answer general ServiceNow documentation questions and ask the user to pick a request for project-specific help.";
  let requestId = body.requestId;
  let documentId: string | undefined;
  if (body.documentId) {
    const doc = await loadDocument(user, body.documentId);
    requestId = doc.requestId;
    documentId = doc.id;
    const g = await loadGenerationContext({ ...user, role: "admin" }, doc.requestId);
    const docText = doc.content.sections.map((s) => `## ${s.title}\n${htmlToText(s.html)}`).join("\n").slice(0, 12000);
    context = `${buildContext(g)}\n\nCURRENT DOCUMENT DRAFT (may contain edits):\n${docText}`;
  } else if (requestId) {
    context = buildContext(await loadGenerationContext(user, requestId));
  }
  const reply = await assistantReply({ userId: user.id, requestId, documentId, operation: "assistant" }, context, body.messages);
  return { reply, html: await markdownToSafeHtml(reply) };
});
