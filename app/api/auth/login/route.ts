import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/auth/session";
import { verifyUserCredentials } from "@/lib/servicenow/client";
import { findEmployeeByUserName } from "@/lib/servicenow/employees";
import { loginInput } from "@/lib/validation/schemas";
import { assertSameOrigin, errorResponse, parseBody } from "@/lib/api/handler";
import { rateLimit } from "@/lib/rate-limit";
import { HttpError } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    rateLimit(`login:${ip}`, 10);
    const { username, password } = await parseBody(req, loginInput);

    let ok = false;
    if (config.dataMode === "servicenow") {
      ok = await verifyUserCredentials(username, password);
    } else if (config.dataMode === "demo") {
      const demoPassword = config.auth.demoPassword;
      if (!demoPassword) throw new HttpError(503, "Demo mode requires DEMO_PASSWORD to be set in production.");
      ok = safeEqual(password, demoPassword);
    } else {
      throw new HttpError(503, "HandoverAI is not configured yet. Set the ServiceNow variables or enable demo mode.");
    }

    const profile = ok ? await findEmployeeByUserName(username) : null;
    if (!ok || !profile) {
      audit("auth.failed", { username, ip, reason: ok ? "no_profile" : "bad_credentials" });
      throw new HttpError(401, ok ? "Your account does not have a HandoverAI profile. Contact an administrator." : "Invalid username or password.");
    }
    if (!profile.active) throw new HttpError(403, "Your HandoverAI profile is inactive.");

    const token = await signSession({ id: profile.id, userName: profile.userName, fullName: profile.fullName, role: profile.role }, config.auth.secret);
    audit("auth.login", { user: profile.id, role: profile.role, ip });
    const res = NextResponse.json({ user: { id: profile.id, fullName: profile.fullName, role: profile.role } });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_HOURS * 3600,
    });
    return res;
  } catch (e) {
    return errorResponse(e, req);
  }
}
