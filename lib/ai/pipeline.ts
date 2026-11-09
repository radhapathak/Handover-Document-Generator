import { z } from "zod";
import { chatJson, chatText, type AiCallContext, type ChatMessage } from "@/lib/ai/groq";
import { analyzePrompt, assistantSystemPrompt, flowchartPrompt, regeneratePrompt, sectionsPrompt, testCasesPrompt } from "@/lib/ai/prompts";
import { AI_SECTIONS, INFO_REQUIRED, sectionDef, type SectionDef } from "@/lib/documents/sections";
import { deriveStatus, escapeHtml, sanitizeSectionHtml } from "@/lib/documents/html";
import { sanitizeMermaid } from "@/lib/mermaid/sanitize";
import { AiError } from "@/lib/ai/groq";
import type { AnalysisResult, DocSection, DocumentRequest, ModuleConfiguration, Project, DocumentTemplate } from "@/types";

const status = z.enum(["ok", "information_required", "conflict"]).catch("ok");

const analysisSchema = z.object({
  summary: z.string().max(4000),
  missingInformation: z.array(z.object({ field: z.string().max(200), reason: z.string().max(1000) })).max(50).default([]),
  conflicts: z.array(z.object({ description: z.string().max(2000), items: z.array(z.string().max(500)).max(20).default([]) })).max(30).default([]),
  suggestions: z.array(z.string().max(1000)).max(30).default([]),
});

const sectionsSchema = z.object({
  sections: z.array(z.object({ key: z.string(), html: z.string().min(1).max(60000), status })).min(1),
});

const regenSchema = z.object({ html: z.string().min(1).max(60000), status });
const flowSchema = z.object({ mermaid: z.string().min(10).max(20000), notes: z.string().max(1000).optional().default("") });
const testSchema = z.object({
  testCases: z
    .array(
      z.object({
        id: z.string().max(20),
        title: z.string().max(300),
        type: z.string().max(20).catch("Positive"),
        preconditions: z.string().max(1000).optional().default(""),
        steps: z.array(z.string().max(500)).min(1).max(20),
        expected: z.string().max(1000),
      })
    )
    .min(1)
    .max(30),
});

export interface GenerationContext {
  project: Project | null;
  request: DocumentRequest;
  module: ModuleConfiguration;
  template: DocumentTemplate | null;
}

const MAX_REFERENCE_CHARS = 15000;

/** Serialises everything the employee supplied. Empty fields are omitted so the AI can spot gaps. */
export function buildContext(g: GenerationContext): string {
  const strip = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)));
  const data = {
    project: g.project ? strip({ name: g.project.name, projectId: g.project.projectCode, application: g.project.applicationName, department: g.project.department, description: g.project.description }) : undefined,
    module: strip({ name: g.module.moduleName, owner: g.module.moduleOwner, department: g.module.businessDepartment, documentType: g.module.documentType, description: g.module.description }),
    configuration: strip(g.module.config as Record<string, unknown>),
  };
  let ctx = `PROJECT CONTEXT (JSON — the only source of truth):\n${JSON.stringify(data, null, 1)}`;
  if (g.request.referenceText) {
    ctx += `\n\nREFERENCE DOCUMENT EXTRACTS (uploaded by the employee; treat as supporting facts):\n${g.request.referenceText.slice(0, MAX_REFERENCE_CHARS)}`;
  }
  return ctx;
}

export async function analyzeConfiguration(ai: AiCallContext, context: string): Promise<AnalysisResult> {
  return chatJson({ ...ai, operation: "analyze" }, analyzePrompt(context), analysisSchema, 3000);
}

const BATCH = 6;

export async function generateSections(
  ai: AiCallContext,
  context: string,
  keys: string[],
  analysis: AnalysisResult,
  templateInstructions = ""
): Promise<DocSection[]> {
  const defs = keys.map((k) => sectionDef(k)).filter((d): d is SectionDef => Boolean(d));
  const summary = [
    analysis.summary,
    analysis.missingInformation.length ? `Missing: ${analysis.missingInformation.map((m) => `${m.field} (${m.reason})`).join("; ")}` : "",
    analysis.conflicts.length ? `Conflicts: ${analysis.conflicts.map((c) => c.description).join("; ")}` : "",
  ].filter(Boolean).join("\n");

  const out: DocSection[] = [];
  for (let i = 0; i < defs.length; i += BATCH) {
    const batch = defs.slice(i, i + BATCH);
    const r = await chatJson({ ...ai, operation: "generate-sections" }, sectionsPrompt(context, batch, summary, templateInstructions), sectionsSchema, 7000);
    for (const def of batch) {
      const got = r.sections.find((s) => s.key === def.key);
      const html = got ? sanitizeSectionHtml(got.html) : "";
      out.push(
        html
          ? { key: def.key, title: def.title, html, status: deriveStatus(html, got?.status) }
          : {
              key: def.key,
              title: def.title,
              html: `<p><strong>${INFO_REQUIRED}:</strong> the AI did not return this section. Use “Regenerate section”.</p>`,
              status: "information_required",
            }
      );
    }
  }
  return out;
}

export async function regenerateSection(ai: AiCallContext, context: string, key: string, currentHtml: string, instructions: string): Promise<DocSection> {
  const def = sectionDef(key);
  if (!def) throw new AiError(`Unknown section "${key}".`, 400);
  const r = await chatJson({ ...ai, operation: "regenerate-section" }, regeneratePrompt(context, def, currentHtml, instructions), regenSchema, 5000);
  const html = sanitizeSectionHtml(r.html);
  if (!html) throw new AiError("The regenerated section was empty after validation. Please try again.");
  return { key, title: def.title, html, status: deriveStatus(html, r.status) };
}

export async function generateFlowchart(ai: AiCallContext, context: string, previous?: { code: string; error: string }) {
  let prev = previous;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chatJson({ ...ai, operation: "generate-flowchart" }, flowchartPrompt(context, prev), flowSchema, 3000);
    const check = sanitizeMermaid(r.mermaid);
    if (check.ok) return { mermaid: check.code, notes: r.notes };
    prev = { code: check.code, error: check.error || "Invalid diagram" };
  }
  throw new AiError(`The AI could not produce a valid diagram (${prev?.error}). Add routing or workflow details and try again.`, 422);
}

export async function generateTestCases(ai: AiCallContext, context: string) {
  const r = await chatJson({ ...ai, operation: "generate-test-cases" }, testCasesPrompt(context), testSchema, 6000);
  const rows = r.testCases
    .map(
      (t) =>
        `<tr><td>${escapeHtml(t.id)}</td><td>${escapeHtml(t.title)}</td><td>${escapeHtml(t.type)}</td><td>${escapeHtml(t.preconditions)}</td><td><ol>${t.steps
          .map((s) => `<li>${escapeHtml(s)}</li>`)
          .join("")}</ol></td><td>${escapeHtml(t.expected)}</td></tr>`
    )
    .join("");
  const html = sanitizeSectionHtml(
    `<table><thead><tr><th>ID</th><th>Scenario</th><th>Type</th><th>Preconditions</th><th>Steps</th><th>Expected Result</th></tr></thead><tbody>${rows}</tbody></table>`
  );
  return { testCases: r.testCases, html };
}

export async function assistantReply(ai: AiCallContext, context: string, messages: { role: "user" | "assistant"; content: string }[]) {
  const convo: ChatMessage[] = [{ role: "system", content: assistantSystemPrompt(context) }, ...messages.slice(-12)];
  return chatText({ ...ai, operation: "assistant" }, convo, 2000);
}

export function defaultSectionKeys(template: DocumentTemplate | null): string[] {
  const valid = new Set(AI_SECTIONS.map((s) => s.key));
  const keys = (template?.sections || []).filter((k) => valid.has(k));
  return keys.length ? keys : AI_SECTIONS.map((s) => s.key);
}
