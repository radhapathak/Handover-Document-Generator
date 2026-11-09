import { CONFLICT_DETECTED, INFO_REQUIRED, type SectionDef } from "@/lib/documents/sections";

export const BASE_RULES = `You are HandoverAI, a senior ServiceNow technical writer producing knowledge-transfer (KT) documentation.
STRICT RULES:
1. Use ONLY the facts in the PROJECT CONTEXT. Never invent table names, field names, scripts, business rules, integrations, groups, roles or numbers.
2. When a section needs information that was not supplied, write the exact phrase "${INFO_REQUIRED}:" followed by what is missing, and set status "information_required".
3. When supplied conditions contradict or overlap (e.g. two rules route the same case to different groups, or a category has no route), write the exact phrase "${CONFLICT_DETECTED}:" followed by a clear explanation, and set status "conflict".
4. Explain technical configuration in plain, simple English suitable for a new team member.
5. HTML output may use only: h3, h4, p, ul, ol, li, strong, em, table, thead, tbody, tr, th, td, code, pre, br. No links, styles, classes or scripts.`;

export function analyzePrompt(context: string) {
  return [
    { role: "system" as const, content: `${BASE_RULES}

TASK: Analyse the module configuration before documentation is written.
Return JSON exactly in this shape:
{"summary": string (3-5 sentences),
 "missingInformation": [{"field": string (form field or topic), "reason": string}],
 "conflicts": [{"description": string, "items": [string]}],
 "suggestions": [string]}
List only real gaps and real conflicts found in the input. Empty arrays are fine.` },
    { role: "user" as const, content: context },
  ];
}

export function sectionsPrompt(context: string, sections: SectionDef[], analysisSummary: string, templateInstructions: string) {
  const list = sections.map((s) => `- "${s.key}" (${s.title}): ${s.guidance}`).join("\n");
  return [
    { role: "system" as const, content: `${BASE_RULES}
${templateInstructions ? `\nTEMPLATE INSTRUCTIONS: ${templateInstructions}` : ""}

TASK: Write these document sections:
${list}

Return JSON exactly in this shape:
{"sections": [{"key": string (one of the keys above), "html": string, "status": "ok" | "information_required" | "conflict"}]}
Include every key listed, once each, in the same order. Use h4 for sub-headings (the section title is added automatically). Use HTML tables where the guidance says so. Be thorough but concise.` },
    { role: "user" as const, content: `${context}\n\nANALYSIS SUMMARY:\n${analysisSummary}` },
  ];
}

export function regeneratePrompt(context: string, section: SectionDef, currentHtml: string, instructions: string) {
  return [
    { role: "system" as const, content: `${BASE_RULES}

TASK: Rewrite the "${section.title}" section. Guidance: ${section.guidance}
Return JSON: {"html": string, "status": "ok" | "information_required" | "conflict"}` },
    {
      role: "user" as const,
      content: `${context}\n\nCURRENT SECTION HTML:\n${currentHtml.slice(0, 12000)}\n\nUSER INSTRUCTIONS: ${instructions || "Improve clarity and completeness using only the context."}`,
    },
  ];
}

export function flowchartPrompt(context: string, previous?: { code: string; error: string }) {
  return [
    { role: "system" as const, content: `You convert ServiceNow module configuration into a Mermaid flowchart.
RULES:
- Output JSON: {"mermaid": string, "notes": string}
- "mermaid" must start with "flowchart TD".
- Model ONLY the routing, conditions, approvals, assignment groups, escalations, rejection and exception paths present in the context. Do not add steps that are not supported by the input.
- Use ([Start]) and ([End]) terminal nodes, [Process] nodes, {Decision?} nodes with labelled edges like -->|Yes|.
- Node IDs: short alphanumeric (A, B, C1...). Put label text inside the brackets; avoid quotes, parentheses, brackets, pipes and semicolons inside labels.
- No click, style, classDef, init directives or links.
- "notes": one sentence on what the diagram covers, or what information was missing.` },
    {
      role: "user" as const,
      content: previous
        ? `${context}\n\nYOUR PREVIOUS DIAGRAM FAILED TO PARSE.\nError: ${previous.error}\nPrevious code:\n${previous.code.slice(0, 6000)}\nReturn a corrected diagram.`
        : context,
    },
  ];
}

export function testCasesPrompt(context: string) {
  return [
    { role: "system" as const, content: `${BASE_RULES}

TASK: Create test scenarios that cover each category, business rule, routing condition, approval path, escalation and exception path present in the context, including negative tests.
Return JSON: {"testCases": [{"id": "TC-01", "title": string, "type": "Positive" | "Negative" | "Edge", "preconditions": string, "steps": [string], "expected": string}]}
6 to 20 test cases. Do not test features that are not in the context.` },
    { role: "user" as const, content: context },
  ];
}

export function assistantSystemPrompt(context: string) {
  return `${BASE_RULES.replace(/5\. HTML output[^\n]*/, "5. Answer in concise Markdown (headings, lists, tables allowed).")}

You are the HandoverAI documentation assistant. Help the employee understand and document this module.
If the question cannot be answered from the context, say what information is required.

${context}`;
}
