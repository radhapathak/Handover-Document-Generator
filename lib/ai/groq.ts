import type { ZodType } from "zod";
import { config } from "@/lib/config";
import { aiLogs } from "@/lib/servicenow/logs";
import { logError } from "@/lib/audit";

export class AiError extends Error {
  constructor(
    message: string,
    public status = 502,
    public detail?: string
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCallContext {
  operation: string;
  userId: string;
  requestId?: string;
  documentId?: string;
}

interface GroqResponse {
  choices: { message: { content: string }; finish_reason: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
  model: string;
}

export function isGroqConfigured() {
  return Boolean(config.groq.apiKey);
}

async function callGroq(messages: ChatMessage[], opts: { json: boolean; maxTokens: number; temperature: number }): Promise<GroqResponse> {
  if (!config.groq.apiKey) {
    throw new AiError("Groq is not configured. Set GROQ_API_KEY (see GROQ_SETUP.md).", 503);
  }
  let res: Response;
  try {
    res = await fetch(`${config.groq.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.groq.apiKey}` },
      body: JSON.stringify({
        model: config.groq.model,
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(120000),
      cache: "no-store",
    });
  } catch (e) {
    throw new AiError("Could not reach the Groq API. Please try again.", 503, String(e));
  }
  if (!res.ok) {
    const body = await res.text();
    const map: Record<number, string> = {
      401: "Groq rejected the API key. Check GROQ_API_KEY.",
      404: `Groq model "${config.groq.model}" was not found. Check GROQ_MODEL.`,
      413: "The input is too large for the AI model. Shorten some fields or uploads.",
      429: "Groq rate limit reached. Please wait a minute and try again.",
    };
    throw new AiError(map[res.status] || `Groq API error (${res.status}).`, res.status === 429 ? 429 : 502, body.slice(0, 500));
  }
  return res.json();
}

async function logCall(ctx: AiCallContext, started: number, r: GroqResponse | null, err?: unknown) {
  try {
    await aiLogs.create({
      operation: ctx.operation,
      model: r?.model || config.groq.model,
      requestId: ctx.requestId || "",
      documentId: ctx.documentId || "",
      userId: ctx.userId,
      promptTokens: r?.usage?.prompt_tokens || 0,
      completionTokens: r?.usage?.completion_tokens || 0,
      durationMs: Date.now() - started,
      status: err ? "error" : "success",
      errorMessage: err ? (err instanceof Error ? err.message : String(err)).slice(0, 3900) : "",
    });
  } catch (e) {
    // Logging must not break the user's action, but the failure is recorded.
    logError("ai-log-write", e, { operation: ctx.operation });
  }
}

/** Plain-text / markdown completion (assistant chat). */
export async function chatText(ctx: AiCallContext, messages: ChatMessage[], maxTokens = 2000): Promise<string> {
  const started = Date.now();
  try {
    const r = await callGroq(messages, { json: false, maxTokens, temperature: 0.3 });
    const text = r.choices?.[0]?.message?.content?.trim() || "";
    if (!text) throw new AiError("The AI returned an empty response. Please try again.");
    await logCall(ctx, started, r);
    return text;
  } catch (e) {
    await logCall(ctx, started, null, e);
    throw e;
  }
}

/**
 * Structured JSON completion validated with Zod. If the model returns invalid JSON or
 * the wrong shape, it is asked once to correct itself with the validation errors.
 */
export async function chatJson<T>(ctx: AiCallContext, messages: ChatMessage[], schema: ZodType<T>, maxTokens = 6000): Promise<T> {
  const started = Date.now();
  let last: GroqResponse | null = null;
  let convo = [...messages];
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      last = await callGroq(convo, { json: true, maxTokens, temperature: 0.2 });
      const raw = last.choices?.[0]?.message?.content || "";
      let problem = "";
      try {
        const parsed = schema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          await logCall(ctx, started, last);
          return parsed.data;
        }
        problem = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      } catch {
        problem = last.choices?.[0]?.finish_reason === "length" ? "Output was cut off (too long). Be more concise." : "Response was not valid JSON.";
      }
      convo = [
        ...messages,
        { role: "assistant", content: raw.slice(0, 4000) },
        { role: "user", content: `Your previous answer was invalid: ${problem}. Reply again with ONLY valid JSON in the required shape.` },
      ];
    }
    throw new AiError("The AI response could not be validated. Please try again.");
  } catch (e) {
    await logCall(ctx, started, last, e);
    throw e;
  }
}
