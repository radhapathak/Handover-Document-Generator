/**
 * Server-side Mermaid safety + shape checks. Full syntax validation happens in the
 * browser with mermaid.parse() before rendering (securityLevel "strict").
 */
export interface MermaidCheck {
  ok: boolean;
  code: string;
  error?: string;
}

const BLOCKED = [/^\s*click\s/i, /%%\{/, /<\s*script/i, /javascript:/i, /\bhref\b/i, /<\s*iframe/i, /^\s*style\s.*url\(/i];

export function sanitizeMermaid(input: string): MermaidCheck {
  let code = (input || "").trim();
  const fence = code.match(/```(?:mermaid)?\s*([\s\S]*?)```/);
  if (fence) code = fence[1].trim();
  code = code
    .split("\n")
    .filter((line) => !BLOCKED.some((re) => re.test(line)))
    .join("\n")
    .trim();

  if (!code) return { ok: false, code, error: "Diagram is empty." };
  if (code.length > 20000) return { ok: false, code: code.slice(0, 20000), error: "Diagram is too large." };
  if (!/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)\b/.test(code)) {
    return { ok: false, code, error: 'Diagram must start with "flowchart TD" (or LR/TB/RL/BT).' };
  }
  const opens = (code.match(/[[({]/g) || []).length;
  const closes = (code.match(/[\])}]/g) || []).length;
  if (opens !== closes) return { ok: false, code, error: "Unbalanced brackets in node labels." };
  const nodeLines = code.split("\n").slice(1).filter((l) => l.trim() && !l.trim().startsWith("%%"));
  if (nodeLines.length < 2) return { ok: false, code, error: "Diagram has too few steps." };
  return { ok: true, code };
}
