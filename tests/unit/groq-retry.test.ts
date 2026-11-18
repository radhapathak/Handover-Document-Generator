import { describe, expect, it, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { chatText } from "@/lib/ai/groq";

let server: http.Server;
const seen: { max_tokens: number }[] = [];
let mode: "rate" | "too_large" = "rate";

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const j = JSON.parse(body);
      seen.push({ max_tokens: j.max_tokens });
      const n = seen.length;
      const ok = () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ model: "m", choices: [{ message: { content: "hello" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
      };
      if (mode === "rate" && n === 1) {
        res.writeHead(429, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: { message: "Rate limit reached ... Limit 8000, Used 7900, Requested 1500. Please try again in 1.0s." } }));
      }
      if (mode === "too_large" && j.max_tokens > 3000) {
        res.writeHead(413, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: { message: `Request too large ... (TPM): Limit 8000, Requested ${j.max_tokens + 6000}, please reduce` } }));
      }
      ok();
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  process.env.GROQ_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.GROQ_API_KEY = "gsk_test";
  process.env.GROQ_MODEL = "test-model";
  process.env.DEMO_MODE = "true";
  delete process.env.SERVICENOW_INSTANCE_URL;
});
afterAll(() => server.close());

describe("Groq rate-limit handling", () => {
  it("waits and retries after a per-minute 429", async () => {
    seen.length = 0;
    mode = "rate";
    const t = Date.now();
    expect(await chatText({ userId: "u", operation: "t" }, [{ role: "user", content: "hi" }], 2000)).toBe("hello");
    expect(seen.length).toBe(2);
    expect(Date.now() - t).toBeGreaterThanOrEqual(1500);
  });
  it("shrinks max_tokens when a single request exceeds the per-minute limit", async () => {
    seen.length = 0;
    mode = "too_large";
    expect(await chatText({ userId: "u", operation: "t" }, [{ role: "user", content: "hi" }], 5000)).toBe("hello");
    expect(seen[0].max_tokens).toBe(5000);
    expect(seen[seen.length - 1].max_tokens).toBeLessThanOrEqual(3000);
  });
});
