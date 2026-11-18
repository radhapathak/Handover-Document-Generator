import type { ZodType } from "zod";
import { config } from "@/lib/config";
import { aiLogs } from "@/lib/servicenow/logs";
import { logError, redact } from "@/lib/audit";

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

function isReasoningModel(model: string) {
  return /gpt-oss|qwen3|deepseek-r1/i.test(model);
}

export function isGroqConfigured() {
  return Boolean(config.groq.apiKey);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Seconds Groq asks us to wait, from the Retry-After header or "try again in 1m2.5s". */
function retryAfterSeconds(res: Response, body: string): number {
  const h = Number(res.headers.get("retry-after"));
  if (h > 0) return h;
  const m = body.match(/try again in (?:(\d+)m)?([\d.]+)s/i);
  return m ? Number(m[1] || 0) * 60 + Number(m[2]) : 10;
}

/** Budget (seconds) a single AI call may spend waiting on Groq rate limits. */
const MAX_WAIT_SECONDS = Number(process.env.GROQ_MAX_WAIT_SECONDS || 90);

async function callGroq(messages: ChatMessage[], opts: { json: boolean; maxTokens: number; temperature: number }): Promise<GroqResponse> {
  const apiKey = config.groq.apiKey.trim();
  if (!apiKey) {
    throw new AiError("Groq is not configured. Set GROQ_API_KEY (see GROQ_SETUP.md).", 503);
  }
  if (/\s/.test(apiKey) || !apiKey.startsWith("gsk_")) {
    throw new AiError("GROQ_API_KEY is not valid: it must be one line starting with gsk_, with no spaces or line breaks. Re-enter it in Vercel and redeploy.", 503);
  }
  const model = config.groq.model.trim();
  const reasoning = isReasoningModel(model);
  let maxTokens = reasoning ? opts.maxTokens + 1500 : opts.maxTokens;
  let waited = 0;

  for (let attempt = 0; attempt < 8; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${config.groq.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          ...(reasoning ? { reasoning_effort: "low" } : {}),
          max_tokens: maxTokens,
          temperature: opts.temperature,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(120000),
        cache: "no-store",
      });
    } catch (e) {
      throw new AiError("Could not reach the Groq API. Please try again.", 503, redact(String(e)));
    }
    if (res.ok) return res.json();

    const body = await res.text();
    const tpm = body.match(/Limit (\d+), Requested (\d+)/);
    // One request bigger than the per-minute token limit: shrink the reply budget and retry.
    if ((res.status === 413 || res.status === 429) && tpm && Number(tpm[2]) > Number(tpm[1])) {
      const over = Number(tpm[2]) - Number(tpm[1]) + 300;
      if (maxTokens - over >= 1200) {
        maxTokens -= over;
        continue;
      }
      throw new AiError("This request is too large for your Groq plan's per-minute token limit. Shorten long fields or uploads, use a template with fewer sections, or upgrade the Groq plan.", 413, body.slice(0, 500));
    }
    // Per-minute quota used up by earlier calls: wait as Groq asks, then retry.
    if (res.status === 429) {
      const wait = Math.min(retryAfterSeconds(res, body) + 1, 60);
      if (waited + wait <= MAX_WAIT_SECONDS) {
        waited += wait;
        await sleep(wait * 1000);
        continue;
      }
      throw new AiError("Groq rate limit reached (free tier: limited tokens per minute). Please wait a minute and try again.", 429, body.slice(0, 500));
    }
    const map: Record<number, string> = {
      401: "Groq rejected the API key. Check GROQ_API_KEY.",
      404: `Groq model "${model}" was not found. Check GROQ_MODEL.`,
      413: "The input is too large for the AI model. Shorten some fields or uploads.",
    };
    throw new AiError(map[res.status] || `Groq API error (${res.status}).`, 502, body.slice(0, 500));
  }
  throw new AiError("Groq is busy (rate limit). Please try again in a minute.", 429);
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
