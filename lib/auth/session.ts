import { SignJWT, jwtVerify } from "jose";
import type { Role, SessionUser } from "@/types";

export const SESSION_COOKIE = "hai_session";
export const SESSION_HOURS = 8;

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser, secret: string): Promise<string> {
  return new SignJWT({ un: user.userName, name: user.fullName, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer("handoverai")
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key(secret));
}

/** Edge-safe: used by proxy.ts and by server routes. */
export async function verifySession(token: string | undefined, secret: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: "handoverai", algorithms: ["HS256"] });
    const role = payload.role as Role;
    if (!payload.sub || (role !== "employee" && role !== "admin")) return null;
    return { id: payload.sub, userName: String(payload.un || ""), fullName: String(payload.name || ""), role };
  } catch {
    return null;
  }
}
