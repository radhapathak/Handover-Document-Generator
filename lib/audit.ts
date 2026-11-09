/**
 * Structured audit + error logging. Lines are JSON so they can be searched in
 * Vercel Logs (or forwarded with a Log Drain). Business events that must be kept
 * (approvals, AI generations) are also written to ServiceNow tables.
 */
export function audit(event: string, data: Record<string, unknown>) {
  console.info(JSON.stringify({ type: "audit", event, at: new Date().toISOString(), ...data }));
}

export function logError(context: string, err: unknown, data: Record<string, unknown> = {}) {
  const e = err instanceof Error ? { message: err.message, name: err.name, stack: err.stack?.split("\n").slice(0, 5).join(" | ") } : { message: String(err) };
  console.error(JSON.stringify({ type: "error", context, at: new Date().toISOString(), ...e, ...data }));
}
