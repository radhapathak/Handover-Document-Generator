"use client";
import { useState } from "react";
import { Database, Sparkles, CheckCircle2, XCircle, PlugZap } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { Badge, Button, Card, ErrorState, PageHeader, Spinner } from "@/components/shared/ui";

interface Status {
  mode: "servicenow" | "demo" | "unconfigured";
  groq: { configured: boolean; model: string };
  servicenow: { ok: boolean; message: string; instance?: string; tables?: { table: string; ok: boolean; error?: string }[] };
}

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<Status>("/api/servicenow/status?full=1");
  const [groqTest, setGroqTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  async function testGroq() {
    setTesting(true);
    setGroqTest(null);
    try {
      const r = await api<{ model: string; ms: number; reply: string }>("/api/ai/test", { method: "POST" });
      setGroqTest({ ok: true, text: `Groq responded in ${r.ms} ms using ${r.model}.` });
    } catch (e) {
      setGroqTest({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally { setTesting(false); }
  }

  return (
    <>
      <PageHeader title="Application Settings" subtitle="Integration status. Secrets are set as environment variables in Vercel and are never shown here." crumbs={[{ label: "Admin Portal", href: "/admin/dashboard" }, { label: "Settings" }]} actions={<Button icon={PlugZap} onClick={reload} loading={loading}>Re-test connections</Button>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <Spinner label="Checking integrations…" /> : (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title={<span className="flex items-center gap-2"><Database className="h-4 w-4" />ServiceNow</span>} actions={<Badge tone={data.mode === "servicenow" ? (data.servicenow.ok ? "green" : "red") : data.mode === "demo" ? "amber" : "red"}>{data.mode === "servicenow" ? (data.servicenow.ok ? "Connected" : "Error") : data.mode === "demo" ? "Demo Mode" : "Not configured"}</Badge>}>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-[13px]">
              <dt className="text-muted">Data source</dt><dd>{data.mode === "servicenow" ? "ServiceNow Table API (OAuth 2.0)" : data.mode === "demo" ? "In-memory sample data (DEMO_MODE=true)" : "None"}</dd>
              {data.servicenow.instance && <><dt className="text-muted">Instance</dt><dd className="break-all">{data.servicenow.instance}</dd></>}
              <dt className="text-muted">Status</dt><dd>{data.servicenow.message}</dd>
            </dl>
            {data.servicenow.tables && (
              <ul className="mt-4 divide-y divide-line rounded-md border border-line text-[12.5px]">
                {data.servicenow.tables.map((t) => (
                  <li key={t.table} className="flex items-start gap-2 px-3 py-2">
                    {t.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 text-red-600" />}
                    <code className="flex-1">{t.table}</code>
                    {t.error && <span className="max-w-[60%] text-red-700">{t.error}</span>}
                  </li>
                ))}
              </ul>
            )}
            {data.mode !== "servicenow" && <p className="mt-4 text-[12.5px] text-muted">To connect, set SERVICENOW_INSTANCE_URL, SERVICENOW_CLIENT_ID and SERVICENOW_CLIENT_SECRET (plus an integration user) as described in SERVICE_NOW_SETUP.md, then redeploy.</p>}
          </Card>
          <Card title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-ai-600" />Groq AI</span>} actions={<Badge tone={data.groq.configured ? "green" : "red"}>{data.groq.configured ? "API key set" : "Not configured"}</Badge>}>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-[13px]">
              <dt className="text-muted">Model</dt><dd><code>{data.groq.model}</code> <span className="text-muted">(GROQ_MODEL)</span></dd>
              <dt className="text-muted">API key</dt><dd>{data.groq.configured ? "Stored server-side in GROQ_API_KEY" : "GROQ_API_KEY is not set — AI features are disabled"}</dd>
            </dl>
            <Button className="mt-4" variant="ai" icon={Sparkles} loading={testing} disabled={!data.groq.configured} onClick={testGroq}>Send test request</Button>
            {groqTest && <p role="status" className={`mt-3 rounded-md p-2 text-[13px] ${groqTest.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{groqTest.text}</p>}
          </Card>
          <Card title="Productivity assumptions" className="xl:col-span-2">
            <p className="text-[13px]">Estimated hours saved per document = the template’s <strong>manual effort baseline</strong> − (AI generation time + review allowance). The review allowance defaults to 1 hour and can be changed with the <code>REVIEW_EFFORT_HOURS</code> environment variable. Edit the baselines on the Templates page.</p>
          </Card>
        </div>
      )}
    </>
  );
}
