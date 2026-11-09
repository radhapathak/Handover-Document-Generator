import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { employees } from "@/lib/servicenow/employees";
import { HttpError } from "@/lib/api/errors";
import type { GeneratedDocument, SessionUser } from "@/types";

const profileCache = new Map<string, { user: SessionUser; at: number }>();
const CACHE_MS = 60000;

/**
 * Returns the signed-in user, re-checked against the employee profile in the data store
 * (cached for 60s) so deactivated users and role changes take effect quickly.
 * The role always comes from the server — never from the request body.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value, config.auth.secret);
  if (!session) return null;
  const hit = profileCache.get(session.id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.user;
  const profile = await employees.get(session.id);
  if (!profile || !profile.active) return null;
  const user: SessionUser = { id: profile.id, userName: profile.userName, fullName: profile.fullName, role: profile.role };
  profileCache.set(session.id, { user, at: Date.now() });
  return user;
}

export function invalidateProfileCache(id?: string) {
  if (id) profileCache.delete(id);
  else profileCache.clear();
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Please sign in.");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin") throw new HttpError(403, "Administrator access required.");
  return u;
}

/** Employees may only see their own documents; admins see everything. */
export function assertCanAccessDocument(user: SessionUser, doc: Pick<GeneratedDocument, "authorId">) {
  if (user.role === "admin") return;
  if (doc.authorId !== user.id) throw new HttpError(404, "Document not found.");
}

export function assertCanAccessRequest(user: SessionUser, req: { requestedBy: string }) {
  if (user.role === "admin") return;
  if (req.requestedBy !== user.id) throw new HttpError(404, "Request not found.");
}
