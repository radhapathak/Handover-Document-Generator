import { route } from "@/lib/api/handler";
import { aiLogs } from "@/lib/servicenow/logs";
import { nameMaps } from "@/lib/views";

export const GET = route("admin", async ({ req }) => {
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") || 0));
  const [{ items, total }, names] = await Promise.all([aiLogs.list({ limit: 50, offset }), nameMaps()]);
  return { total, items: items.map((l) => ({ ...l, userName: names.person.get(l.userId) || "Unknown" })) };
});
