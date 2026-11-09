import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { HttpError } from "@/lib/api/errors";
import { IntegrationError } from "@/lib/store/types";
import { AiError } from "@/lib/ai/groq";
import { logError } from "@/lib/audit";
import type { SessionUser } from "@/types";

type Ctx<P> = { req: NextRequest; user: SessionUser; params: P };

/**
 * Wraps a route handler with: authentication, server-side role check,
 * same-origin check for state-changing requests, and consistent JSON errors.
 */
export function route<P = Record<string, string>>(
  access: "user" | "admin",
  fn: (ctx: Ctx<P>) => Promise<Response | unknown>
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      assertSameOrigin(req);
      const user = access === "admin" ? await requireAdmin() : await requireUser();
      const params = (await context?.params) || ({} as P);
      const out = await fn({ req, user, params });
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      return errorResponse(e, req);
    }
  };
}

export function errorResponse(e: unknown, req?: NextRequest) {
  if (e instanceof HttpError) {
    const headers: Record<string, string> = {};
    const d = e.details as { retryAfter?: number } | undefined;
    if (e.status === 429 && d?.retryAfter) headers["Retry-After"] = String(d.retryAfter);
    return NextResponse.json({ error: e.message, details: e.details }, { status: e.status, headers });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input.", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 }
    );
  }
  if (e instanceof IntegrationError) {
    logError("integration", e, { path: req?.nextUrl.pathname, detail: e.detail });
    return NextResponse.json({ error: e.message, source: "servicenow" }, { status: e.status });
  }
  if (e instanceof AiError) {
    logError("ai", e, { path: req?.nextUrl.pathname, detail: e.detail });
    return NextResponse.json({ error: e.message, source: "groq" }, { status: e.status });
  }
  logError("unhandled", e, { path: req?.nextUrl.pathname });
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Blocks cross-site form posts (CSRF) in addition to SameSite=Lax cookies. */
export function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients; still need a valid session cookie
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Cross-origin request blocked.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Cross-origin request blocked.");
  }
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
  return schema.parse(json);
}
