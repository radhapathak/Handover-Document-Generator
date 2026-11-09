import { NextResponse } from "next/server";
import { route } from "@/lib/api/handler";
import { config } from "@/lib/config";
import { checkServiceNowConnection } from "@/lib/servicenow/client";
import { TABLES, tableName, type TableKey } from "@/lib/servicenow/schema";
import { isGroqConfigured } from "@/lib/ai/groq";

/** Integration status for the banner (all users) — full table check for admins with ?full=1. */
export const GET = route("user", async ({ req, user }) => {
  const mode = config.dataMode;
  const base = { mode, groq: { configured: isGroqConfigured(), model: config.groq.model } };
  if (mode !== "servicenow") return NextResponse.json({ ...base, servicenow: { ok: mode === "demo", message: mode === "demo" ? "Demo mode: sample data held in server memory. Nothing is saved to ServiceNow." : "Not configured." } });
  const full = req.nextUrl.searchParams.get("full") === "1" && user.role === "admin";
  const tables = full ? (Object.keys(TABLES) as TableKey[]).map((k) => tableName(k, config.servicenow.tablePrefix)) : [tableName("employee_profile", config.servicenow.tablePrefix)];
  const sn = await checkServiceNowConnection(tables);
  return NextResponse.json({ ...base, servicenow: { ...sn, instance: user.role === "admin" ? config.servicenow.instanceUrl : undefined } });
});
