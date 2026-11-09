// TEST DOUBLE ONLY: a small imitation of the ServiceNow OAuth, Table and Attachment APIs
// (encoded queries, X-Total-Count, sysparm_limit/offset, 401 on bad tokens, 404 on unknown tables)
// so the real lib/servicenow/client.ts code path is exercised end to end.
import http from "node:http";
import crypto from "node:crypto";

const port = Number(process.env.MOCK_SN_PORT || 4020);
const CLIENT = { id: "test-client", secret: "test-secret" };
const USERS = { integration: "int-pass", "priya.sharma": "pw-priya", "meera.nair": "pw-meera" };
const TABLES = ["project", "module_configuration", "document_request", "generated_document", "document_version", "document_approval", "employee_profile", "document_template", "ai_generation_log"].map((t) => `x_hai_${t}`);
const db = Object.fromEntries(TABLES.map((t) => [t, new Map()]));
const attachments = [];
const tokens = new Map();
let counter = 1000;
export const stats = { tokenRequests: 0, apiRequests: 0 };

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const id = () => crypto.randomBytes(16).toString("hex");
function insert(table, values) {
  const r = { sys_id: id(), sys_created_on: now(), sys_updated_on: now(), ...values };
  if (table === "x_hai_document_request" && !r.number) r.number = `HDR${String(++counter).padStart(7, "0")}`;
  db[table].set(r.sys_id, r);
  return r;
}
insert("x_hai_employee_profile", { user_name: "priya.sharma", full_name: "Priya Sharma", email: "priya@example.com", department: "ITSM", job_title: "Developer", role: "employee", active: "true" });
insert("x_hai_employee_profile", { user_name: "meera.nair", full_name: "Meera Nair", email: "meera@example.com", department: "Governance", job_title: "Platform Owner", role: "admin", active: "true" });
insert("x_hai_project", { name: "Change Enablement", project_id: "PRJ-2001", application_name: "ServiceNow ITSM", department: "ITSM", status: "active" });
insert("x_hai_document_template", { name: "Standard Module Handover", document_type: "Technical Handover", sections_json: JSON.stringify(["executive_summary", "module_overview", "categories", "business_rules", "workflow_routing", "assignment_groups", "approval_process", "notifications", "testing_scenarios", "troubleshooting", "faq", "handover_checklist"]), manual_effort_hours: "16", active: "true", instructions: "" });

function parseQuery(q) {
  const conds = [];
  let order = null;
  for (const part of (q || "").split("^").filter(Boolean)) {
    if (part.startsWith("ORDERBYDESC")) order = { f: part.slice(11), desc: true };
    else if (part.startsWith("ORDERBY")) order = { f: part.slice(7), desc: false };
    else if (/^[a-z_]+IN/.test(part)) { const [f, v] = part.split(/IN(.*)/s); conds.push((r) => v.split(",").includes(r[f] ?? "")); }
    else { const i = part.indexOf("="); const f = part.slice(0, i), v = part.slice(i + 1); conds.push((r) => (r[f] ?? "") === v); }
  }
  return { conds, order };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(chunks);
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === "/oauth_token.do") {
      stats.tokenRequests++;
      const p = new URLSearchParams(raw.toString());
      if (p.get("client_id") !== CLIENT.id || p.get("client_secret") !== CLIENT.secret) return send(res, 401, { error: "invalid_client" });
      if (p.get("grant_type") === "password" && USERS[p.get("username")] !== p.get("password")) return send(res, 401, { error: "access_denied" });
      const t = id();
      tokens.set(t, Date.now() + 1800e3);
      return send(res, 200, { access_token: t, token_type: "Bearer", expires_in: 1800, refresh_token: id() });
    }
    const auth = (req.headers.authorization || "").replace("Bearer ", "");
    if (!tokens.has(auth) || tokens.get(auth) < Date.now()) return send(res, 401, { error: { message: "User Not Authenticated" } });
    stats.apiRequests++;

    if (url.pathname === "/api/now/attachment/file" && req.method === "POST") {
      const a = { sys_id: id(), table_name: url.searchParams.get("table_name"), table_sys_id: url.searchParams.get("table_sys_id"), file_name: url.searchParams.get("file_name"), content_type: req.headers["content-type"], size_bytes: String(raw.length), sys_created_on: now() };
      attachments.push(a);
      return send(res, 201, { result: a });
    }
    if (url.pathname === "/api/now/attachment") {
      const { conds } = parseQuery(url.searchParams.get("sysparm_query"));
      return send(res, 200, { result: attachments.filter((a) => conds.every((c) => c(a))) });
    }
    const m = url.pathname.match(/^\/api\/now\/table\/([a-z0-9_]+)(?:\/([A-Za-z0-9_]+))?$/);
    if (!m) return send(res, 404, { error: { message: "Not found" } });
    const [, table, sysId] = m;
    if (!db[table]) return send(res, 404, { error: { message: "Invalid table " + table } });
    const t = db[table];
    if (req.method === "GET" && !sysId) {
      const { conds, order } = parseQuery(url.searchParams.get("sysparm_query"));
      let rows = [...t.values()].filter((r) => conds.every((c) => c(r)));
      if (order) rows.sort((a, b) => ((a[order.f] ?? "") > (b[order.f] ?? "") ? 1 : -1) * (order.desc ? -1 : 1));
      const off = Number(url.searchParams.get("sysparm_offset") || 0), lim = Number(url.searchParams.get("sysparm_limit") || 10000);
      return send(res, 200, { result: rows.slice(off, off + lim) }, { "X-Total-Count": String(rows.length) });
    }
    if (req.method === "GET") return t.has(sysId) ? send(res, 200, { result: t.get(sysId) }) : send(res, 404, { error: { message: "No Record found" } });
    if (req.method === "POST") return send(res, 201, { result: insert(table, JSON.parse(raw.toString() || "{}")) });
    if (req.method === "PATCH") {
      if (!t.has(sysId)) return send(res, 404, { error: { message: "No Record found" } });
      const r = { ...t.get(sysId), ...JSON.parse(raw.toString() || "{}"), sys_updated_on: now() };
      t.set(sysId, r);
      return send(res, 200, { result: r });
    }
    if (req.method === "DELETE") { t.delete(sysId); res.writeHead(204); return res.end(); }
    send(res, 405, { error: { message: "Method not allowed" } });
  });
});
server.listen(port, () => console.log(`mock-servicenow listening on ${port}`));
