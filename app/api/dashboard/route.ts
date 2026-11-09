import { route } from "@/lib/api/handler";
import { employeeDashboard } from "@/lib/analytics";

export const GET = route("user", async ({ user }) => employeeDashboard(user));
