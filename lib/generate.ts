// Groq's API is OpenAI-compatible: https://console.groq.com/docs/api-reference
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const PROMPT = `You are a ServiceNow technical writer. Using ONLY the configuration JSON provided,
write a knowledge-transfer document for a new administrator of the "{module}" module.

Sections (use <h2> headings):
1. Module Overview (2-3 sentences)
2. Categories & Subcategories (HTML table)
3. Routing / Assignment Logic (in rule order; explain each condition in plain English)
4. SLAs (HTML table: name, duration, when it starts, when it stops)
5. Automations (business rules and notifications, one line each)
6. Gaps & Things to Check (e.g. categories with no routing rule, overlapping rules)

Then output a Mermaid "flowchart TD" diagram of how a new record is categorised
and routed to a group, inside a \`\`\`mermaid code block.

Rules: Output clean HTML (no <html>/<body> tags) except the Mermaid block.
Never invent configuration that is not in the JSON. If unclear, write "Needs confirmation".`;

export type KTResult = { html: string; mermaid: string; pngBase64: string };

export async function generateKT(module: string, config: string): Promise<KTResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      temperature: 0.2,
      messages: [
        { role: "system", content: PROMPT.replaceAll("{module}", module) },
        { role: "user", content: "Configuration JSON:\n" + config },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Groq returned an empty response");

  const m = text.match(/```mermaid\s*([\s\S]*?)```/);
  const mermaid = m ? m[1].trim() : "";
  const html = text
    .replace(/```mermaid[\s\S]*?```/, "")
    .replace(/```html|```/g, "")
    .trim();

  // Render the diagram to PNG so ServiceNow can attach it as an image.
  let pngBase64 = "";
  if (mermaid) {
    try {
      const kroki = process.env.KROKI_URL || "https://kroki.io";
      const r = await fetch(`${kroki}/mermaid/png`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: mermaid,
      });
      if (r.ok) pngBase64 = Buffer.from(await r.arrayBuffer()).toString("base64");
    } catch {
      // Diagram image is optional; the Mermaid text is still returned.
    }
  }

  return { html, mermaid, pngBase64 };
}
