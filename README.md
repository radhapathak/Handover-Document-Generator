# Handover Document Generator

Turns a ServiceNow module's configuration (categories, assignment rules, SLAs, business rules,
notifications) into a knowledge-transfer document plus a routing flow diagram, using Claude.

- `POST /api/generate` – called by ServiceNow. Header `x-kt-secret`, body `{ "module": "incident", "config": {...} }`.
  Returns `{ html, mermaid, pngBase64 }`.
- `/` – demo page: paste config JSON, generate, view the document and diagram, download as HTML.

## Environment variables (set in Vercel → Project → Settings → Environment Variables)

| Name | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Anthropic API key |
| `KT_SHARED_SECRET` | yes | Shared secret ServiceNow (and the demo page) must send |
| `KROKI_URL` | no | Kroki server for diagram PNGs (default `https://kroki.io`) |
| `KT_MODEL` | no | Override the Claude model |

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

## Test the API

```bash
curl -X POST https://<your-app>.vercel.app/api/generate \
  -H "Content-Type: application/json" -H "x-kt-secret: <secret>" \
  -d '{"module":"incident","config":{"assignmentRules":[{"name":"Network","condition":"category=network","group":"NetOps"}]}}'
```

Do not send script bodies, credentials or personal data in the config.
