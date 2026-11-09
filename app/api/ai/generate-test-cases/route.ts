import { z } from "zod";
import { route, parseBody } from "@/lib/api/handler";
import { aiPreflight, editableDocContext } from "@/lib/ai/route-helpers";
import { generateTestCases } from "@/lib/ai/pipeline";
import { generatedDocuments } from "@/lib/servicenow/documents";
import { sectionDef } from "@/lib/documents/sections";
import { id } from "@/lib/validation/schemas";

export const maxDuration = 120;

export const POST = route("user", async ({ req, user }) => {
  const { documentId } = await parseBody(req, z.object({ documentId: id }));
  aiPreflight(user);
  const { doc, context } = await editableDocContext(user, documentId);
  const r = await generateTestCases({ userId: user.id, documentId: doc.id, requestId: doc.requestId, operation: "generate-test-cases" }, context);
  const key = "testing_scenarios";
  const section = { key, title: sectionDef(key)!.title, html: r.html, status: "ok" as const };
  const exists = doc.content.sections.some((s) => s.key === key);
  const sections = exists ? doc.content.sections.map((s) => (s.key === key ? section : s)) : [...doc.content.sections, section];
  await generatedDocuments.update(doc.id, { content: { sections } });
  return { testCases: r.testCases, section };
});
