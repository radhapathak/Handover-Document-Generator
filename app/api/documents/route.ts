import { route } from "@/lib/api/handler";
import { nameMaps, visibleDocuments, docSummary } from "@/lib/views";

export const GET = route("user", async ({ user, req }) => {
  const state = req.nextUrl.searchParams.get("state");
  const [docs, names] = await Promise.all([visibleDocuments(user), nameMaps()]);
  return { items: docs.filter((d) => !state || d.state === state).map((d) => docSummary(d, names)) };
});
