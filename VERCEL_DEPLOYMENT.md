# Vercel Deployment Guide

## 1. Prerequisites
- The repository on GitHub (for example `radhapathak/handover-document-generator`)
- ServiceNow configured as described in **SERVICE_NOW_SETUP.md** (or use Demo Mode to evaluate)
- A Groq API key (see **GROQ_SETUP.md**)

## 2. Import the project
1. **vercel.com → Add New → Project →** import the repository.
2. Framework preset: **Next.js** (detected automatically). Build command `next build`, output `.next`, Node.js 20+ (22 recommended).

## 3. Environment variables
**Project → Settings → Environment Variables.** Add these for **Production** (and Preview if you use it):

| Variable | Required | Value |
|---|---|---|
| `AUTH_SECRET` | ✅ | Output of `openssl rand -base64 48` (32+ chars). Changing it signs everyone out. |
| `GROQ_API_KEY` | ✅ | Your `gsk_…` key. Mark as **Sensitive**. |
| `GROQ_MODEL` | ✅ | For example `openai/gpt-oss-120b` |
| `SERVICENOW_INSTANCE_URL` | ✅ | `https://<instance>.service-now.com` (no trailing slash) |
| `SERVICENOW_CLIENT_ID` | ✅ | From the OAuth Application Registry |
| `SERVICENOW_CLIENT_SECRET` | ✅ | Mark as **Sensitive** |
| `SERVICENOW_USERNAME` / `SERVICENOW_PASSWORD` | ✅* | Integration user (*or leave both empty for client_credentials) |
| `SERVICENOW_TABLE_PREFIX` | ✅ | Your app scope, for example `x_12345_hai` |
| `AI_RATE_LIMIT_PER_MINUTE`, `MAX_UPLOAD_MB`, `REVIEW_EFFORT_HOURS` | — | Optional tuning |
| `KT_SHARED_SECRET` | — | Only if the legacy `/api/generate` endpoint is used |

**Demo deployment** (no ServiceNow): leave `SERVICENOW_INSTANCE_URL` empty, then set `DEMO_MODE=true` and a `DEMO_PASSWORD`. Demo data lives in the memory of each serverless instance. It is **not persistent** and can differ between instances, so use it only for walkthroughs, never production.

> Secrets exist only in Vercel's encrypted environment variables. `.env*.local` is git-ignored, and no secret is ever sent to the browser: all ServiceNow and Groq calls run in server routes.

## 4. Deploy
Click **Deploy**. After the build:
1. Open the production URL and sign in with an account that has an **admin** employee profile.
2. Go to **Admin → Settings**. All nine ServiceNow tables should be green, then click **Send test request** for Groq.
3. As an employee: create a request, generate a document, export DOCX/PDF, and submit it. As an admin: approve and publish it.

## 5. Function duration
Generating a full document makes about 5 Groq calls. `/api/ai/generate-document` sets `maxDuration = 300` seconds, and the other AI routes use 60–120 seconds. Vercel's Fluid compute (the default for new projects) allows this on all plans. If generation times out on your plan, use a faster Groq model, or a template with fewer sections.

## 6. Global rate limiting (recommended)
The built-in limiter works per server instance. For a hard global limit, open **Project → Firewall → Configure → New Rule**:
- If **Request Path** starts with `/api/ai/` → **Rate Limit** 30 requests / 60 s per IP → action **Deny (429)**.
- Optionally limit `/api/auth/login` to 10 requests / 60 s per IP.

## 7. Security checklist
- [ ] `AUTH_SECRET` is long and random, and differs per environment
- [ ] The ServiceNow integration user is *web-service-only* with the `x_hai.integration` role only
- [ ] `DEMO_MODE` is **not** set in production
- [ ] Preview deployments use a ServiceNow **sub-production** instance (or Vercel Deployment Protection is on)
- [ ] Firewall rate-limit rule added
- [ ] Custom domain with HTTPS (automatic on Vercel)

Security headers (`X-Frame-Options: DENY`, `nosniff`, `HSTS`, `Referrer-Policy`, `Permissions-Policy`) are set in `next.config.ts`.

## 8. Logs and monitoring
- **Vercel → Project → Logs:** structured JSON lines. `"type":"audit"` covers sign-ins, generation, submissions and reviews; `"type":"error"` carries context. Forward them to your SIEM with a Log Drain if needed.
- **ServiceNow:** `x_hai_document_approval` (approval trail) and `x_hai_ai_generation_log` (AI calls).

## 9. Updating
Push to `main` and Vercel builds and deploys automatically. Run `npm run lint:types && npm test` locally (and `npm run build && npm run test:e2e`) before pushing.
