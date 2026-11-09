import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * First line of defence: unauthenticated users are sent to /login and employees
 * cannot open /admin pages. Every API route and layout re-checks on the server.
 */
export async function proxy(req: NextRequest) {
  const secret = process.env.AUTH_SECRET || "";
  const session = secret.length >= 32 ? await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  const { pathname } = req.nextUrl;
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/employee/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/employee/:path*", "/admin/:path*"] };
