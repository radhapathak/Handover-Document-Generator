import { config } from "@/lib/config";
import type { RawRecord } from "@/lib/servicenow/schema";
import {
  IntegrationError,
  safeQueryValue,
  type AttachmentMeta,
  type ListOptions,
  type ListResult,
  type TableStore,
} from "@/lib/store/types";

/* ---------------------------------------------------------------------------
 * OAuth 2.0 token management (server-side only).
 * Uses the password grant when an integration user is configured,
 * otherwise client_credentials. Tokens are cached until 60s before expiry.
 * ------------------------------------------------------------------------- */

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;
let inflight: Promise<CachedToken> | null = null;

const TIMEOUT_MS = 20000;

async function requestToken(body: URLSearchParams): Promise<{ access_token: string; expires_in: number }> {
  const sn = config.servicenow;
  let res: Response;
  try {
    res = await fetch(`${sn.instanceUrl}/oauth_token.do`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new IntegrationError("Cannot reach the ServiceNow instance.", 503, String(e));
  }
  const text = await res.text();
  if (!res.ok) {
    throw new IntegrationError(
      res.status === 401 ? "ServiceNow rejected the credentials." : `ServiceNow OAuth error (${res.status}).`,
      res.status === 401 ? 401 : 502,
      text.slice(0, 500)
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new IntegrationError("ServiceNow OAuth returned an unexpected response.", 502, text.slice(0, 200));
  }
}

function assertConfigured() {
  const sn = config.servicenow;
  if (sn.authMode === "basic") {
    if (!sn.instanceUrl || !sn.username || !sn.password) {
      throw new IntegrationError("ServiceNow Basic auth needs SERVICENOW_INSTANCE_URL, SERVICENOW_USERNAME and SERVICENOW_PASSWORD.", 503);
    }
  } else if (!sn.instanceUrl || !sn.clientId || !sn.clientSecret) {
    throw new IntegrationError(
      "ServiceNow is not fully configured. Set SERVICENOW_INSTANCE_URL, SERVICENOW_CLIENT_ID and SERVICENOW_CLIENT_SECRET.",
      503
    );
  }
  const localDev = process.env.NODE_ENV !== "production" || process.env.HAI_ALLOW_HTTP_LOCALHOST === "true";
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(sn.instanceUrl);
  if (!/^https:\/\//.test(sn.instanceUrl) && !(localDev && isLocal)) {
    throw new IntegrationError("SERVICENOW_INSTANCE_URL must start with https://", 503);
  }
}

export async function getServiceToken(force = false): Promise<string> {
  assertConfigured();
  if (!force && cachedToken && cachedToken.expiresAt - 60000 > Date.now()) return cachedToken.accessToken;
  if (!inflight) {
    const sn = config.servicenow;
    const body = new URLSearchParams({ client_id: sn.clientId, client_secret: sn.clientSecret });
    if (sn.username && sn.password) {
      body.set("grant_type", "password");
      body.set("username", sn.username);
      body.set("password", sn.password);
    } else {
      body.set("grant_type", "client_credentials");
    }
    inflight = requestToken(body)
      .then((t) => {
        cachedToken = { accessToken: t.access_token, expiresAt: Date.now() + (Number(t.expires_in) || 1800) * 1000 };
        return cachedToken;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return (await inflight).accessToken;
}

/** Verifies an end user's ServiceNow credentials (password grant). The user's token is discarded. */
export async function verifyUserCredentials(username: string, password: string): Promise<boolean> {
  assertConfigured();
  const sn = config.servicenow;
  if (sn.authMode === "basic") return verifyUserBasic(username, password);
  try {
    await requestToken(
      new URLSearchParams({
        grant_type: "password",
        client_id: sn.clientId,
        client_secret: sn.clientSecret,
        username,
        password,
      })
    );
    return true;
  } catch (e) {
    if (e instanceof IntegrationError && e.status === 401) {
      // ServiceNow's reason (e.g. invalid_client vs access_denied) — no secrets are included.
      console.warn(JSON.stringify({ type: "auth", event: "servicenow.password_grant_rejected", user: username, detail: (e.detail || "").slice(0, 300) }));
      return false;
    }
    throw e;
  }
}

const basicHeader = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

/** Basic mode: a user is genuine if ServiceNow accepts their credentials on a minimal REST call. */
async function verifyUserBasic(username: string, password: string): Promise<boolean> {
  const sn = config.servicenow;
  const q = new URLSearchParams({ sysparm_limit: "1", sysparm_fields: "sys_id", sysparm_query: `user_name=${safeQueryValue(username)}` });
  let res: Response;
  try {
    res = await fetch(`${sn.instanceUrl}/api/now/table/sys_user?${q}`, {
      headers: { Accept: "application/json", Authorization: basicHeader(username, password) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new IntegrationError("Cannot reach the ServiceNow instance.", 503, String(e));
  }
  if (res.status === 401) {
    console.warn(JSON.stringify({ type: "auth", event: "servicenow.basic_rejected", user: username, detail: (await res.text()).slice(0, 300) }));
    return false;
  }
  // 200, or 403 (authenticated but not allowed to read sys_user) both prove the credentials are valid.
  if (res.ok || res.status === 403) return true;
  throw new IntegrationError(`ServiceNow sign-in check failed (${res.status}).`, 502, (await res.text()).slice(0, 300));
}

async function authHeader(): Promise<string> {
  const sn = config.servicenow;
  if (sn.authMode === "basic") {
    assertConfigured();
    return basicHeader(sn.username, sn.password);
  }
  return `Bearer ${await getServiceToken()}`;
}

async function snFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const authorization = await authHeader();
  let res: Response;
  try {
    res = await fetch(`${config.servicenow.instanceUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", Authorization: authorization, ...(init.headers || {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new IntegrationError("Cannot reach the ServiceNow instance.", 503, String(e));
  }
  if (res.status === 401 && !retried && config.servicenow.authMode === "oauth") {
    cachedToken = null; // token expired or revoked: refresh once
    return snFetch(path, init, true);
  }
  if (res.status === 401) {
    throw new IntegrationError("ServiceNow rejected the integration user's credentials. Check SERVICENOW_USERNAME and SERVICENOW_PASSWORD.", 401, (await res.text()).slice(0, 300));
  }
  if (!res.ok) {
    const text = await res.text();
    let message = `ServiceNow API error (${res.status}).`;
    try {
      const j = JSON.parse(text);
      if (j?.error?.message) message = `ServiceNow: ${j.error.message}`;
    } catch {
      /* not JSON */
    }
    if (res.status === 403) message += " Check the integration user's roles and the table ACLs.";
    if (res.status === 404 && path.includes("/api/now/table/")) message += " Has the table been created? See SERVICE_NOW_SETUP.md.";
    throw new IntegrationError(message, res.status === 404 ? 404 : 502, text.slice(0, 500));
  }
  return res;
}

const COMMON = "sysparm_display_value=false&sysparm_exclude_reference_link=true";

function encodeQuery(opts: ListOptions): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(opts.where || {})) parts.push(`${k}=${safeQueryValue(v)}`);
  for (const [k, vs] of Object.entries(opts.whereIn || {})) parts.push(`${k}IN${vs.map(safeQueryValue).join(",")}`);
  if (opts.orderBy) parts.push(`${opts.desc ? "ORDERBYDESC" : "ORDERBY"}${opts.orderBy}`);
  return parts.join("^");
}

export const serviceNowStore: TableStore = {
  kind: "servicenow",

  async list(table, opts = {}): Promise<ListResult> {
    const q = encodeQuery(opts);
    const params = new URLSearchParams({
      sysparm_query: q,
      sysparm_limit: String(opts.limit ?? 100),
      sysparm_offset: String(opts.offset ?? 0),
    });
    const res = await snFetch(`/api/now/table/${table}?${COMMON}&${params}`);
    const j = await res.json();
    return { records: j.result || [], total: Number(res.headers.get("X-Total-Count") || (j.result || []).length) };
  },

  async get(table, sysId) {
    try {
      const res = await snFetch(`/api/now/table/${table}/${encodeURIComponent(sysId)}?${COMMON}`);
      return (await res.json()).result || null;
    } catch (e) {
      if (e instanceof IntegrationError && e.status === 404 && !e.message.includes("table been created")) return null;
      if (e instanceof IntegrationError && e.status === 404) {
        // ServiceNow returns 404 both for a missing record and a missing table; check the table exists.
        await snFetch(`/api/now/table/${table}?sysparm_limit=1`);
        return null;
      }
      throw e;
    }
  },

  async create(table, values) {
    const res = await snFetch(`/api/now/table/${table}?${COMMON}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    return (await res.json()).result;
  },

  async update(table, sysId, values) {
    const res = await snFetch(`/api/now/table/${table}/${encodeURIComponent(sysId)}?${COMMON}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    return (await res.json()).result;
  },

  async remove(table, sysId) {
    await snFetch(`/api/now/table/${table}/${encodeURIComponent(sysId)}`, { method: "DELETE" });
  },

  async uploadAttachment(table, sysId, fileName, contentType, data) {
    const params = new URLSearchParams({ table_name: table, table_sys_id: sysId, file_name: fileName });
    const res = await snFetch(`/api/now/attachment/file?${params}`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: new Uint8Array(data),
    });
    const a = (await res.json()).result;
    return toAttachment(a);
  },

  async listAttachments(table, sysId) {
    const params = new URLSearchParams({
      sysparm_query: `table_name=${safeQueryValue(table)}^table_sys_id=${safeQueryValue(sysId)}`,
    });
    const res = await snFetch(`/api/now/attachment?${params}`);
    return ((await res.json()).result || []).map(toAttachment);
  },
};

function toAttachment(a: RawRecord): AttachmentMeta {
  return {
    id: a.sys_id,
    fileName: a.file_name,
    contentType: a.content_type,
    sizeBytes: Number(a.size_bytes || 0),
    createdAt: a.sys_created_on,
  };
}

/** Connection check used by the integration status banner and the admin Settings page. */
export async function checkServiceNowConnection(tables: string[]): Promise<{
  ok: boolean;
  message: string;
  tables: { table: string; ok: boolean; error?: string }[];
}> {
  try {
    if (config.servicenow.authMode === "oauth") await getServiceToken(true);
    else assertConfigured();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e), tables: [] };
  }
  const results = await Promise.all(
    tables.map(async (t) => {
      try {
        await snFetch(`/api/now/table/${t}?sysparm_limit=1&sysparm_fields=sys_id`);
        return { table: t, ok: true };
      } catch (e) {
        return { table: t, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    message: failed.length ? `${failed.length} table(s) not reachable.` : `Connected to ServiceNow (${config.servicenow.authMode === "basic" ? "Basic auth" : "OAuth 2.0"}).`,
    tables: results,
  };
}
