import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { config } from "@/lib/config";
import { chatJson } from "@/lib/ai/groq";
import { errorResponse } from "@/lib/api/handler";
import { rateLimit } from "@/lib/rate-limit";
import { HttpError } from "@/lib/api/errors";
import { sanitizeSectionHtml } from "@/lib/documents/html";
import { sanitizeMermaid } from "@/lib/mermaid/sanitize";
import { BASE_RULES } from "@/lib/ai/prompts";

/**
 * LEGACY endpoint kept from v1 for the ServiceNow Script Include ("KT Vercel" REST Message).
 * Auth: x-kt-secret header. Body {module, config}. Returns {html, mermaid, pngBase64:""}.
 */
export const maxDuration = 120;

const body = z.object({ module: z.string().trim().min(1).max(200), config: z.union([z.string().max(200000), z.record(z.string(), z.unknown())]) });
const out = z.object({ html: z.string().min(1).max(100000), mermaid: z.string().max(20000).optional().default("") });

export async function POST(req: NextRequest) {
  try {
    const secret = config.legacySharedSecret;
    const given = req.headers.get("x-kt-secret") || "";
    if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
      throw new HttpError(401, "Unauthorized");
    }
    rateLimit("legacy-generate", config.limits.aiRequestsPerMinute);
    const b = body.parse(await req.json());
    const cfg = typeof b.config === "string" ? b.config : JSON.stringify(b.config);
    const r = await chatJson(
      { userId: "", operation: "legacy-generate" },
      [
        { role: "system", content: `${BASE_RULES}\nTASK: Write a knowledge-transfer document for the "${b.module}" module (overview, categories, routing, SLAs, automations, gaps). Return JSON {"html": string, "mermaid": string (flowchart TD of routing)}.` },
        { role: "user", content: `Configuration JSON:\n${cfg.slice(0, 60000)}` },
      ],
      out,
      8000
    );
    const m = sanitizeMermaid(r.mermaid);
    return NextResponse.json({ html: sanitizeSectionHtml(r.html), mermaid: m.ok ? m.code : "", pngBase64: "" });
  } catch (e) {
    return errorResponse(e, req);
  }
}
