# HandoverAI

**AI-powered knowledge transfer and handover documentation, backed by ServiceNow.**

An employee describes a module's configuration in plain English: categories, business rules, routing, approvals, scripts, integrations. Groq AI then writes a structured 26-section handover document and a Mermaid process flow. The document is edited, reviewed and approved in the app, stored in ServiceNow, and downloaded as Word or PDF.

> Goal: cut a ~2-day manual KT document to roughly 1 hour of input and review. Hours saved are shown as **estimates** (template baseline − AI time − review allowance).

## Architecture

```
Employee / Admin browser  (Next.js + React + Tailwind)
        │  session cookie (httpOnly, signed JWT)
        ▼
Next.js API routes on Vercel  ── Zod validation · RBAC · rate limits · audit log
        │                                  │
        │ OAuth 2.0 (server only)          │ Bearer GROQ_API_KEY (server only)
        ▼                                  ▼
ServiceNow Table + Attachment APIs      Groq Chat Completions (JSON mode)
  9 custom x_hai_* tables
```

| Layer | Location |
|---|---|
| Pages (employee and admin portals) | `app/employee/*`, `app/admin/*`, `app/login` |
| API routes | `app/api/**` |
| ServiceNow integration | `lib/servicenow/client.ts` (OAuth, tokens, Table/Attachment API), `projects.ts`, `documents.ts`, `approvals.ts`, `employees.ts`, `templates.ts`, `logs.ts`, `schema.ts` |
| Groq AI | `lib/ai/groq.ts` (client, JSON validation, retries, logging), `prompts.ts`, `pipeline.ts` |
| Documents | `lib/documents/*` (lifecycle, sanitiser, DOCX/PDF export, uploads) |
| Auth and security | `lib/auth/*`, `proxy.ts`, `lib/api/handler.ts`, `lib/rate-limit.ts`, `lib/audit.ts` |
| Validation | `lib/validation/schemas.ts` |
| UI components | `components/{shared,dashboard,forms,documents,editor,flowcharts,approvals}` |

## Features

**Employee portal**
- Sign in with ServiceNow credentials
- Dashboard with KPIs: projects, documents, drafts, pending approvals, approved, estimated hours saved
- Multi-section request form (A–E), with repeatable categories, business rules, assignment groups and approval stages; pick an existing project or add a new one
- Reference uploads (.docx, .pdf, .txt, .md, .csv, .json; 5 MB). Files are stored as ServiceNow attachments and their text is used as AI context
- AI analysis flags **Information Required** and **Configuration Conflict Detected**
- One-click generation of the 26-part document (cover page, document information, revision history, table of contents and 23 AI sections)
- Rich-text editor with headings, lists, tables, undo; strictly sequential auto-save with retry; per-section regeneration with instructions; AI test-case generation
- Mermaid diagram: preview, zoom, edit code with syntax validation, regenerate, "Fix with AI" for parse errors, SVG/PNG download; included in exports
- Version history and side-by-side word diff
- Submit and resubmit for approval; reviewer comments shown to the author
- DOCX export (Word table of contents, page X of Y) and PDF export (table of contents with page numbers, page X of Y)
- AI documentation assistant that uses the selected project's configuration as context

**Admin portal**
- Dashboard with global filters (date range, project, employee, module, status), KPIs, charts, pending approvals and recent activity
- Approval queue: approve, reject or request changes (comments required), comment, publish
- Manage employees (roles and active flag), projects and templates (sections, AI instructions, manual-effort baseline)
- Analytics: documents per month, by project, by employee, pending vs approved, manual vs AI time, approval turnaround
- AI activity log (tokens, duration, errors), and integration settings with live ServiceNow table checks and a Groq test call

**Document lifecycle:** `Draft → AI Generated → Under Review → Approved / Changes Requested / Rejected → Published`. The server enforces it; documents can't be edited while under review or after approval.

## Quick start (local)

```bash
npm install
cp .env.example .env.local      # fill in values
npm run dev                      # http://localhost:3000
```

**Try it without ServiceNow:** set `DEMO_MODE=true`, `AUTH_SECRET` (32+ chars) and `GROQ_API_KEY`, and leave `SERVICENOW_INSTANCE_URL` empty. Sign in as `priya.sharma` (employee) or `meera.nair` (admin) with `DEMO_PASSWORD` (development default `demo1234`). Demo Mode is labelled throughout the UI, holds sample data in server memory only, and is never used as a silent fallback: when ServiceNow is configured but unreachable, the app shows the connection error.

**Production:** follow **SERVICE_NOW_SETUP.md**, then **GROQ_SETUP.md**, then **VERCEL_DEPLOYMENT.md**.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint:types` | TypeScript check |
| `npm test` | Unit tests (Vitest): mapping, validation, lifecycle, sanitiser, Mermaid checks, demo store, DOCX/PDF generation |
| `npm run test:e2e` | After `npm run build`: full browser workflow in Chromium (Playwright) in **demo mode** and against a **mock ServiceNow** (OAuth, Table and Attachment APIs) with a **mock Groq** |
| `npm run schema:docs` | Print the ServiceNow table definitions from `lib/servicenow/schema.ts` |

## Security

- Secrets (`GROQ_API_KEY`, ServiceNow client secret and integration password, `AUTH_SECRET`) are read only in server code and are never sent to the browser or committed.
- Sessions are signed (HS256), `httpOnly`, `SameSite=Lax`, `Secure` in production, and last 8 hours. Roles come from the ServiceNow employee profile and are re-checked on the server every 60 s; they are **never** taken from the request.
- `proxy.ts` gates pages, and every API route re-checks authentication and role. Employees can only reach their own requests and documents (others return 404). Admins can't review their own documents.
- Zod validates every input. Encoded-query values are checked to prevent ServiceNow query injection. Mutations require a same-origin check.
- AI output and editor HTML pass through an allow-list sanitiser. Mermaid is checked on the server and parsed in the browser with `securityLevel: "strict"`.
- Uploads are checked by extension, size and magic bytes. Names are sanitised and text is capped.
- AI endpoints are rate-limited per user (add the Vercel Firewall rule for a global limit). Login is rate-limited per IP.
- Audit trail: approval records and AI logs in ServiceNow, plus structured JSON audit and error logs in Vercel.

## Extending sign-in
Sign-in checks the user's ServiceNow credentials with the OAuth password grant. For SSO-only instances, put an OIDC provider (for example Okta or Entra ID) in front of the app and map the identity to `x_hai_employee_profile.user_name` in `app/api/auth/login/route.ts`.

## Testing status
- ✅ TypeScript, production build, 18 unit tests, and 80 end-to-end checks (40 per mode) pass.
- ✅ The end-to-end suite exercises the real ServiceNow client code (OAuth token fetch and caching, encoded queries, pagination headers, attachments) against a **local mock** of the ServiceNow APIs, and the real AI pipeline against a **local mock** of Groq.
- ⚠️ It has **not yet been run against a live ServiceNow instance or the live Groq API**. Do that after setup using **Admin → Settings**, and with one real document generation.
