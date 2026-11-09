import { route } from "@/lib/api/handler";
import { config } from "@/lib/config";

export const GET = route("user", async ({ user }) => ({ user, mode: config.dataMode }));
