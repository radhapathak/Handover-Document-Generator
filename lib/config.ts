import type { DataMode } from "@/types";

/** Server-only configuration. Never import this from a client component. */
export const config = {
  get dataMode(): DataMode {
    if (process.env.SERVICENOW_INSTANCE_URL) return "servicenow";
    if (process.env.DEMO_MODE === "true") return "demo";
    return "unconfigured";
  },
  servicenow: {
    get instanceUrl() {
      return (process.env.SERVICENOW_INSTANCE_URL || "").replace(/\/+$/, "");
    },
    get clientId() {
      return process.env.SERVICENOW_CLIENT_ID || "";
    },
    get clientSecret() {
      return process.env.SERVICENOW_CLIENT_SECRET || "";
    },
    /** Optional integration user for the OAuth password grant. Without it, client_credentials is used. */
    get username() {
      return process.env.SERVICENOW_USERNAME || "";
    },
    get password() {
      return process.env.SERVICENOW_PASSWORD || "";
    },
    get tablePrefix() {
      return process.env.SERVICENOW_TABLE_PREFIX || "x_hai";
    },
    /** "oauth" (default) or "basic" — Basic auth over HTTPS for instances that block the OAuth password grant. */
    get authMode(): "oauth" | "basic" {
      return process.env.SERVICENOW_AUTH_MODE === "basic" ? "basic" : "oauth";
    },
  },
  groq: {
    get apiKey() {
      return process.env.GROQ_API_KEY || "";
    },
    get model() {
      return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    },
    get baseUrl() {
      return (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
    },
  },
  auth: {
    get secret() {
      const s = process.env.AUTH_SECRET || "";
      if (s.length < 32) {
        throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
      }
      return s;
    },
    get demoPassword() {
      if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD;
      if (process.env.NODE_ENV !== "production") return "demo1234";
      return "";
    },
  },
  limits: {
    aiRequestsPerMinute: Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 10),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024,
  },
  /** Legacy endpoint (/api/generate) used by the ServiceNow Script Include. */
  get legacySharedSecret() {
    return process.env.KT_SHARED_SECRET || "";
  },
};
