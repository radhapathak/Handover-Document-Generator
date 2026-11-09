import { config } from "@/lib/config";
import { Suspense } from "react";
import { LoginForm } from "@/components/shared/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const mode = config.dataMode;
  let authReady = true;
  try {
    void config.auth.secret;
  } catch {
    authReady = false;
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ai-600 font-bold">H</span>
          <span className="text-lg font-semibold">HandoverAI</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold leading-snug">Knowledge-transfer documents in about an hour, not two days.</h1>
          <p className="mt-3 text-[14px] text-slate-300">Describe a module’s configuration in plain English. Groq AI drafts the full handover document and process flow; reviewers approve it; ServiceNow keeps the record.</p>
          <ul className="mt-6 space-y-2 text-[13.5px] text-slate-300">
            <li>• 26-section handover documents with table of contents</li>
            <li>• Missing-information and conflict detection</li>
            <li>• Mermaid workflow diagrams, Word and PDF export</li>
            <li>• Review and approval workflow with version history</li>
          </ul>
        </div>
        <p className="text-[12px] text-slate-500">Data is stored in your ServiceNow instance.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold text-navy-900">Sign in</h2>
          <p className="mt-1 text-[13px] text-muted">
            {mode === "servicenow" ? "Use your ServiceNow user name and password." : mode === "demo" ? "Demo Mode is enabled." : "HandoverAI is not configured yet."}
          </p>
          {!authReady && <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">AUTH_SECRET is missing or shorter than 32 characters. Sign-in is disabled until it is set.</p>}
          {mode === "unconfigured" && <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">Set the SERVICENOW_* variables (see SERVICE_NOW_SETUP.md), or DEMO_MODE=true to explore with sample data.</p>}
          <Suspense>
            <LoginForm mode={mode} disabled={!authReady || mode === "unconfigured"} />
          </Suspense>
          {mode === "demo" && (
            <div className="mt-6 rounded-md border border-line bg-white p-3 text-[12.5px] text-muted">
              <p className="font-medium text-ink">Demo accounts</p>
              <p className="mt-1">Employee: <code>priya.sharma</code> · Admin: <code>meera.nair</code></p>
              <p>Password: the value of <code>DEMO_PASSWORD</code>{process.env.NODE_ENV !== "production" && !process.env.DEMO_PASSWORD ? " (development default: demo1234)" : ""}.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
