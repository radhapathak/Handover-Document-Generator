import { HttpError } from "@/lib/api/errors";

/**
 * Sliding-window rate limiter. In-memory, so the limit applies per server instance;
 * for strict global limits on Vercel add a Vercel Firewall rate-limit rule on /api/ai/*
 * (see VERCEL_DEPLOYMENT.md).
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs = 60000) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    const retry = Math.ceil((windowMs - (now - arr[0])) / 1000);
    throw new HttpError(429, `Too many AI requests. Please wait ${retry} seconds and try again.`, { retryAfter: retry });
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
}
