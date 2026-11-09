// TEST DOUBLE ONLY: mimics Groq's OpenAI-compatible /chat/completions so the e2e suite
// can exercise the real AI pipeline (prompting, JSON validation, retries, logging) offline.
import http from "node:http";

const port = Number(process.env.MOCK_GROQ_PORT || 4010);
export const calls = [];

function reply(content) {
  return { id: "mock", model: "mock-llama", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }], usage: { prompt_tokens: 1200, completion_tokens: 800 } };
}

function respond(body) {
  const sys = body.messages.find((m) => m.role === "system")?.content || "";
  const user = body.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  if (/single word OK/.test(user)) return "OK";
  if (sys.includes("TASK: Analyse")) {
    return JSON.stringify({ summary: "Change Management routes changes by category and requires CAB approval for high risk.", missingInformation: [{ field: "escalationRules", reason: "No escalation timings were provided." }], conflicts: [{ description: "Two rules assign Network changes to different groups.", items: ["Network to NetOps", "All to CAB"] }], suggestions: ["Add SLA durations."] });
  }
  if (sys.includes("TASK: Write these document sections")) {
    const keys = [...sys.matchAll(/^- "([a-z_]+)"/gm)].map((m) => m[1]);
    return JSON.stringify({ sections: keys.map((k) => ({ key: k, status: k === "notifications" ? "information_required" : k === "workflow_routing" ? "conflict" : "ok", html: k === "notifications" ? "<p><strong>Information Required:</strong> notification recipients were not provided.</p>" : k === "workflow_routing" ? "<p>Changes are routed by category.</p><p><strong>Configuration Conflict Detected:</strong> two rules route Network changes differently.</p>" : `<h4>${k} overview</h4><p>Generated text for <strong>${k}</strong> from the supplied configuration.</p><ul><li>Point one</li><li>Point two</li></ul>${k === "categories" ? "<table><thead><tr><th>Category</th><th>Subcategories</th></tr></thead><tbody><tr><td>Network</td><td>Firewall, VPN</td></tr></tbody></table>" : ""}<script>alert(1)</script>` })) });
  }
  if (sys.includes("TASK: Rewrite the")) return JSON.stringify({ html: "<p>Regenerated section text, simplified for a new employee.</p>", status: "ok" });
  if (sys.includes("Mermaid flowchart")) {
    return JSON.stringify({ mermaid: "flowchart TD\n  A([Start]) --> B[Change submitted]\n  B --> C{Category}\n  C -->|Network| D[Assign NetOps]\n  C -->|Other| E[Assign Change Team]\n  D --> F{High risk}\n  E --> F\n  F -->|Yes| G[CAB approval]\n  F -->|No| H[Implement]\n  G -->|Approved| H\n  G -->|Rejected| I[Notify requester]\n  H --> J([End])\n  I --> J", notes: "Covers routing and CAB approval." });
  }
  if (sys.includes("TASK: Create test scenarios")) {
    return JSON.stringify({ testCases: [{ id: "TC-01", title: "Network change routes to NetOps", type: "Positive", preconditions: "User can raise changes", steps: ["Create change", "Set category Network"], expected: "Assigned to NetOps" }, { id: "TC-02", title: "Rejected CAB approval", type: "Negative", preconditions: "High risk change", steps: ["Submit", "CAB rejects"], expected: "Requester notified" }] });
  }
  return "### Routing explained\n\n1. Changes are categorised.\n2. **Network** changes go to NetOps.\n\n_Information Required_: escalation timings.";
}

const server = http.createServer((req, res) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    if (req.url !== "/chat/completions" || req.headers.authorization !== "Bearer test-groq-key") {
      res.writeHead(req.url === "/chat/completions" ? 401 : 404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "bad request" } }));
    }
    const body = JSON.parse(data);
    calls.push(body);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(reply(respond(body))));
  });
});
server.listen(port, () => console.log(`mock-groq listening on ${port}`));
