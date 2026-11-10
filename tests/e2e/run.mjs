// End-to-end test: runs the production build against (1) demo mode and (2) a mock ServiceNow
// instance, with a mock Groq API, and drives the full employee → admin workflow in Chromium.
// Usage: npm run build && npm run test:e2e
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
// Uses the project's Playwright if installed, otherwise a globally installed one (NODE_PATH).
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUT = process.env.E2E_OUT || path.join(ROOT, "tests/e2e/output");
fs.mkdirSync(OUT, { recursive: true });
const procs = [];
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`); if (!ok) throw new Error(`Check failed: ${name} ${extra}`); };

function start(cmd, args, env, label) {
  const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  p.stdout.on("data", (d) => process.env.E2E_VERBOSE && process.stdout.write(`[${label}] ${d}`));
  p.stderr.on("data", (d) => fs.appendFileSync(path.join(OUT, `${label}.log`), d));
  procs.push(p);
  return p;
}
async function waitFor(url) {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await sleep(500); }
  throw new Error(`Timed out waiting for ${url}`);
}

async function login(browser, base, user, pass) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [browser error]", e.message));
  await page.goto(`${base}/login`);
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(employee|admin)\/dashboard/, { timeout: 15000 });
  return { ctx, page };
}

async function flow(mode, base, creds) {
  const tag = (s) => `[${mode}] ${s}`;
  const browser = await chromium.launch();
  try {
    // --- unauthenticated access is blocked
    const anon = await fetch(`${base}/api/documents`);
    check(tag("API rejects anonymous requests (401)"), anon.status === 401);
    const redirect = await fetch(`${base}/employee/dashboard`, { redirect: "manual" });
    check(tag("pages redirect anonymous users to /login"), redirect.status === 307 && redirect.headers.get("location")?.includes("/login"));

    // --- bad password
    const bad = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: creds.employee[0], password: "wrong" }) });
    check(tag("wrong password is rejected"), bad.status === 401);

    // --- employee
    const emp = await login(browser, base, ...creds.employee);
    let p = emp.page;
    await p.waitForSelector("text=Estimated Hours Saved");
    check(tag("employee dashboard renders KPIs"), await p.isVisible("text=Pending Approvals"));
    await p.screenshot({ path: path.join(OUT, `${mode}-employee-dashboard.png`) });

    await p.goto(`${base}/admin/dashboard`);
    await p.waitForURL(/employee\/dashboard/);
    check(tag("employee cannot open the admin portal"), p.url().includes("/employee/dashboard"));
    const forbidden = await p.evaluate(() => fetch("/api/employees").then((r) => r.status));
    check(tag("employee gets 403 from admin API"), forbidden === 403);
    const forged = await p.evaluate(() => fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: "x.y", fullName: "X Y", role: "admin" }) }).then((r) => r.status));
    check(tag("employee cannot create admin profiles"), forged === 403);

    await p.goto(`${base}/employee/new-request`);
    await p.waitForSelector("#project");
    const opt = await p.$$eval("#project option", (os) => os.map((o) => o.value).filter(Boolean));
    await p.selectOption("#project", opt[0]);
    const tpl = await p.$$eval("#tpl option", (os) => os.find((o) => o.textContent.includes("Standard"))?.value);
    await p.selectOption("#tpl", tpl);
    await p.fill("#module", "Change Management");
    await p.fill("#owner", "Priya Sharma");
    await p.fill("#businessPurpose", "Control the lifecycle of all changes to reduce risk.");
    await p.fill("[aria-label='Categories 1 Category']", "Network");
    await p.fill("[aria-label='Categories 1 Subcategories']", "Firewall, VPN");
    await p.fill("[aria-label='Business Rules 1 Rule name']", "Network to NetOps");
    await p.fill("[aria-label='Business Rules 1 When / condition']", "category = Network");
    await p.click("text=Add business rule");
    await p.fill("[aria-label='Business Rules 2 Rule name']", "All to CAB");
    await p.screenshot({ path: path.join(OUT, `${mode}-new-request.png`), fullPage: false });
    await p.click("text=Save draft request");
    await p.waitForURL(/new-request\?id=/, { timeout: 15000 });
    const requestId = new URL(p.url()).searchParams.get("id");
    check(tag("request saved"), Boolean(requestId));

    // invalid upload type is rejected, valid upload accepted
    const badUpload = await p.evaluate(async (id) => { const f = new FormData(); f.append("file", new File(["MZ"], "evil.exe")); return (await fetch(`/api/requests/${id}/attachments`, { method: "POST", body: f })).status; }, requestId);
    check(tag("disallowed file type rejected (415)"), badUpload === 415);
    const ref = path.join(OUT, "reference.txt");
    fs.writeFileSync(ref, "Existing runbook: CAB meets every Tuesday. Emergency changes need ECAB approval.");
    await p.waitForSelector("text=Upload reference document");
    await p.setInputFiles("input[type=file]", ref);
    await p.waitForSelector("text=reference.txt", { timeout: 15000 });
    check(tag("reference document uploaded"), true);

    await p.click("text=Analyse configuration");
    await p.waitForSelector("text=Configuration analysis", { timeout: 30000 });
    check(tag("analysis shows Information Required and conflicts"), (await p.isVisible("text=Information Required (1)")) && (await p.isVisible("text=Configuration Conflict Detected (1)")));

    await p.click("text=Generate documentation");
    await p.waitForURL(/\/employee\/documents\/[A-Za-z0-9_]+$/, { timeout: 60000 });
    const docId = p.url().split("/").pop();
    await p.waitForSelector(".ProseMirror");
    check(tag("generated document opens in editor"), true);
    const html = await p.evaluate(async (id) => (await (await fetch(`/api/documents/${id}`)).json()).document.content.sections.map((s) => s.html).join(""), docId);
    check(tag("AI HTML is sanitised before saving (no <script>)"), !html.includes("<script"));
    check(tag("conflict + missing info flagged"), (await p.isVisible("text=Configuration Conflict Detected")) && (await p.isVisible("text=Information Required")));
    await p.screenshot({ path: path.join(OUT, `${mode}-editor.png`) });

    // edit + autosave
    await p.click(".ProseMirror");
    await p.keyboard.press("End");
    await p.keyboard.type(" Edited by the employee.");
    await p.waitForSelector("text=/Saved \\d/", { timeout: 15000 });
    const saved = await p.evaluate(async (id) => (await (await fetch(`/api/documents/${id}`)).json()).document.content.sections[0].html, docId);
    check(tag("auto-save persisted the edit"), saved.includes("Edited by the employee."));

    // regenerate section
    await p.click("text=Regenerate section");
    await p.fill("textarea", "Simplify for a new employee");
    await p.click("div[role=dialog] button:has-text('Regenerate')");
    await p.waitForSelector("text=Regenerated section text", { timeout: 20000 });
    check(tag("section regenerated"), true);

    // test cases
    await p.click("button:has-text('Testing Scenarios')");
    await p.click("text=Generate test cases");
    await p.waitForSelector("text=Network change routes to NetOps", { timeout: 20000 });
    check(tag("test cases generated into section"), true);

    // diagram
    await p.click("role=tab[name=/Workflow diagram/]");
    await p.waitForSelector("svg[id^=hai-mmd]", { timeout: 20000 });
    check(tag("Mermaid diagram rendered"), true);
    await p.click("[aria-label='Zoom in']");
    check(tag("diagram zoom works"), await p.isVisible("text=115%"));
    const [pngDl] = await Promise.all([p.waitForEvent("download"), p.click("button:has-text('PNG')")]);
    const pngPath = path.join(OUT, `${mode}-diagram-download.png`);
    await pngDl.saveAs(pngPath);
    check(tag("diagram PNG download"), fs.readFileSync(pngPath).subarray(1, 4).toString() === "PNG");
    const [svgDl] = await Promise.all([p.waitForEvent("download"), p.click("button:has-text('SVG')")]);
    const svgName = svgDl.suggestedFilename();
    check(tag("diagram SVG download"), svgName.endsWith(".svg"), svgName);
    await p.screenshot({ path: path.join(OUT, `${mode}-diagram.png`) });

    // invalid mermaid is refused by the API
    const badMermaid = await p.evaluate((id) => fetch(`/api/documents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mermaid: "sequenceDiagram\nA->>B: x" }) }).then((r) => r.status), docId);
    check(tag("invalid diagram rejected by server"), badMermaid === 400);

    // exports
    for (const fmt of ["DOCX", "PDF"]) {
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.click(`button:has-text('${fmt}')`)]);
      const file = path.join(OUT, `${mode}-export.${fmt.toLowerCase()}`);
      await dl.saveAs(file);
      const head = fs.readFileSync(file).subarray(0, 5).toString();
      check(tag(`${fmt} export downloaded`), fmt === "DOCX" ? head.startsWith("PK") : head === "%PDF-", `${fs.statSync(file).size} bytes`);
      const bytes = fs.readFileSync(file);
      const hasImage = fmt === "DOCX" ? bytes.includes(Buffer.from("word/media/")) : bytes.includes(Buffer.from("/Subtype /Image"));
      check(tag(`${fmt} export includes the workflow diagram image`), hasImage);
    }

    // submit
    await p.click("button:has-text('Submit for approval')");
    await p.click("div[role=dialog] button:has-text('Confirm')");
    await p.waitForSelector("text=Submitted for approval.");
    check(tag("submitted → Under Review"), await p.isVisible("header ~ main >> text=Under Review") || await p.isVisible("text=Under Review"));
    const editLocked = await p.evaluate((id) => fetch(`/api/documents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Hacked title" }) }).then((r) => r.status), docId);
    check(tag("document locked while under review (409)"), editLocked === 409);

    // assistant
    await p.goto(`${base}/employee/assistant?doc=${docId}`);
    await p.fill("[aria-label=Message]", "Explain the routing logic");
    await p.click("button:has-text('Send')");
    await p.waitForSelector(".chat-md >> text=Routing explained", { timeout: 20000 });
    check(tag("assistant answers with project context"), true);
    await emp.ctx.close();

    // --- admin: request changes
    const adm = await login(browser, base, ...creds.admin);
    p = adm.page;
    await p.waitForSelector("text=Pending approval requests");
    await p.waitForSelector(".recharts-surface");
    await p.screenshot({ path: path.join(OUT, `${mode}-admin-dashboard.png`) });
    check(tag("admin dashboard renders charts"), true);
    await p.goto(`${base}/admin/approvals`);
    await p.click("text=Change Management — Technical Handover");
    await p.waitForURL(/admin\/documents\//);
    await p.click("button:has-text('Request changes')");
    await p.click("div[role=dialog] button:has-text('Confirm')");
    await p.waitForSelector("text=Comments are required", { timeout: 5000 }).catch(() => {});
    check(tag("request-changes requires a comment"), await p.isVisible("div[role=dialog]"));
    await p.fill("div[role=dialog] textarea", "Please add escalation timings for emergency changes.");
    await p.click("div[role=dialog] button:has-text('Confirm')");
    await p.waitForSelector("text=Changes requested.");
    check(tag("admin requested changes"), true);
    await adm.ctx.close();

    // --- employee resubmits
    const emp2 = await login(browser, base, ...creds.employee);
    p = emp2.page;
    await p.goto(`${base}/employee/documents/${docId}`);
    await p.waitForSelector("text=Please add escalation timings");
    check(tag("employee sees reviewer comments"), true);
    await p.click(".ProseMirror");
    await p.keyboard.type(" Escalation: 4 hours.");
    await p.click("button:has-text('Resubmit')");
    await p.click("div[role=dialog] button:has-text('Confirm')");
    await p.waitForSelector("text=Submitted for approval.");
    check(tag("employee resubmitted"), true);
    await emp2.ctx.close();

    // --- admin approves + publishes
    const adm2 = await login(browser, base, ...creds.admin);
    p = adm2.page;
    await p.goto(`${base}/admin/documents/${docId}`);
    await p.click("button:has-text('Approve')");
    await p.click("div[role=dialog] button:has-text('Confirm')");
    await p.waitForSelector("text=Document approved.");
    await p.click("button:has-text('Publish')");
    await p.waitForSelector("text=Document published.");
    const final = await p.evaluate(async (id) => (await (await fetch(`/api/documents/${id}`)).json()).document, docId);
    check(tag("document published"), final.state === "published", `v${final.currentVersion}`);
    await p.click("role=tab[name=/Approval history/]");
    await p.screenshot({ path: path.join(OUT, `${mode}-approval-history.png`) });
    const versions = await p.evaluate(async (id) => (await (await fetch(`/api/documents/${id}/versions`)).json()).items.length, docId);
    check(tag("version history stored"), versions >= 3, `${versions} versions`);
    await p.click("button:has-text('Compare versions')");
    await p.waitForSelector("text=Added");
    check(tag("version compare shows diffs"), true);
    await p.keyboard.press("Escape");

    await p.goto(`${base}/admin/analytics`);
    await p.waitForSelector(".recharts-surface");
    const charts = await p.$$eval(".recharts-surface", (e) => e.length);
    check(tag("analytics renders 6 charts"), charts >= 6, `${charts} charts`);
    await p.screenshot({ path: path.join(OUT, `${mode}-analytics.png`), fullPage: true });

    await p.goto(`${base}/admin/settings`);
    await p.click("text=Send test request");
    await p.waitForSelector("text=/Groq responded/");
    check(tag("admin Groq connection test"), true);
    await p.screenshot({ path: path.join(OUT, `${mode}-settings.png`) });

    await p.goto(`${base}/admin/ai-activity`);
    await p.waitForSelector("text=generate-sections");
    check(tag("AI calls logged"), true);
    await adm2.ctx.close();
  } finally {
    await browser.close();
  }
}

const BASE_ENV = { AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-123456", GROQ_API_KEY: "test-groq-key", GROQ_BASE_URL: "http://127.0.0.1:4010", GROQ_MODEL: "mock-llama", AI_RATE_LIMIT_PER_MINUTE: "100", HAI_ALLOW_HTTP_LOCALHOST: "true" };

try {
  start("node", ["tests/e2e/mock-groq.mjs"], {}, "mock-groq");
  start("node", ["tests/e2e/mock-servicenow.mjs"], {}, "mock-sn");
  await sleep(800);

  const modes = (process.env.E2E_MODES || "demo,servicenow,servicenow-basic").split(",");
  for (const [i, mode] of modes.entries()) {
    const port = 3200 + i;
    const env = mode === "demo"
      ? { ...BASE_ENV, DEMO_MODE: "true", DEMO_PASSWORD: "demo-pass", SERVICENOW_INSTANCE_URL: "" }
      : { ...BASE_ENV, SERVICENOW_INSTANCE_URL: "http://127.0.0.1:4020", SERVICENOW_CLIENT_ID: mode === "servicenow-basic" ? "" : "test-client", SERVICENOW_CLIENT_SECRET: mode === "servicenow-basic" ? "" : "test-secret", SERVICENOW_USERNAME: "integration", SERVICENOW_PASSWORD: "int-pass", SERVICENOW_AUTH_MODE: mode === "servicenow-basic" ? "basic" : "oauth" };
    const app = start("npx", ["next", "start", "-p", String(port)], env, `app-${mode}`);
    await waitFor(`http://127.0.0.1:${port}/login`);
    console.log(`\n=== ${mode.toUpperCase()} MODE ===`);
    const creds = mode === "demo" ? { employee: ["priya.sharma", "demo-pass"], admin: ["meera.nair", "demo-pass"] } : { employee: ["priya.sharma", "pw-priya"], admin: ["meera.nair", "pw-meera"] };
    await flow(mode, `http://localhost:${port}`, creds);
    app.kill();
  }
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
} catch (e) {
  console.error("\nE2E FAILED:", e.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) p.kill();
}
