import { z } from "zod";
import { route } from "@/lib/api/handler";
import { adminAnalytics } from "@/lib/analytics";
import { id } from "@/lib/validation/schemas";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const filters = z.object({
  from: day,
  to: day,
  projectId: id.optional(),
  employeeId: id.optional(),
  module: z.string().max(200).optional(),
  state: z.string().regex(/^[a-z_]{2,30}$/).optional(),
});

export const GET = route("admin", async ({ user, req }) => {
  const p = Object.fromEntries([...req.nextUrl.searchParams.entries()].filter(([, v]) => v !== ""));
  return adminAnalytics(user, filters.parse(p));
});
