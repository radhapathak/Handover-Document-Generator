import { route } from "@/lib/api/handler";
import { nextSteps } from "@/lib/next-steps";

export const GET = route("user", async ({ user, req }) => {
  const area = req.nextUrl.searchParams.get("area") === "admin" && user.role === "admin" ? "admin" : "employee";
  return { items: await nextSteps(user, area) };
});
