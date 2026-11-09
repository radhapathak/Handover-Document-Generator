import { route } from "@/lib/api/handler";
import { aiPreflight } from "@/lib/ai/route-helpers";
import { chatText } from "@/lib/ai/groq";
import { config } from "@/lib/config";

/** Admin connectivity check: a tiny real Groq call. */
export const POST = route("admin", async ({ user }) => {
  aiPreflight(user);
  const started = Date.now();
  const reply = await chatText({ userId: user.id, operation: "connection-test" }, [{ role: "user", content: "Reply with the single word OK." }], 5);
  return { ok: true, model: config.groq.model, reply, ms: Date.now() - started };
});
