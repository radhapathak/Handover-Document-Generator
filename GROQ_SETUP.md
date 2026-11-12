# Groq Setup Guide

HandoverAI uses Groq's OpenAI-compatible Chat Completions API **from the server only** (`lib/ai/groq.ts`). The API key is never sent to the browser.

## 1. Create an API key
1. Sign in at **https://console.groq.com**.
2. **API Keys → Create API Key**, and name it `HandoverAI`.
3. Copy the key (it starts with `gsk_`). Groq shows it only once.
4. Store it as `GROQ_API_KEY` in Vercel (or `.env.local` for local development). Never paste it into code, chat or ServiceNow.

## 2. Choose a model
Set `GROQ_MODEL` to a chat model currently listed at **https://console.groq.com/docs/models**. Groq retires models over time, so check the list (`llama-3.3-70b-versatile` was retired for free/developer accounts in August 2026; see https://console.groq.com/docs/deprecations). For reasoning models such as `openai/gpt-oss-120b` the app sends `reasoning_effort: "low"` and extra token headroom automatically. The default is `openai/gpt-oss-120b`.

The model must support:
- **JSON mode** (`response_format: {"type":"json_object"}`): used for analysis, sections, diagrams and test cases.
- At least **~8k output tokens** per call: sections are generated in batches of 6.

If the model is retired or misspelled, the app shows: *Groq model "…" was not found. Check GROQ_MODEL.*

## 3. How the app uses Groq

| Endpoint | What it does | Output (validated with Zod) |
|---|---|---|
| `POST /api/ai/analyze` | Finds missing information and conflicting conditions | `{summary, missingInformation[], conflicts[], suggestions[]}` |
| `POST /api/ai/generate-document` | Analysis → sections in batches of 6 → flowchart | 23 sections of sanitised HTML + Mermaid |
| `POST /api/ai/regenerate-section` | Rewrites one section with optional instructions | `{html, status}` |
| `POST /api/ai/generate-flowchart` | Builds or repairs the Mermaid diagram (gets the browser's parse error) | `{mermaid, notes}` |
| `POST /api/ai/generate-test-cases` | Test scenarios for the Testing Scenarios section | `{testCases[]}` |
| `POST /api/ai/assistant` | Chat answers using the project's configuration as context | Markdown, sanitised to HTML on the server |

Safeguards:
- The system prompt forbids inventing table names, fields, scripts or integrations. Missing details must be written as **"Information Required:"** and contradictions as **"Configuration Conflict Detected:"**. The UI flags those sections.
- Every JSON reply is schema-validated. On failure the model gets one retry with the validation errors; after that the user sees a clear error. Nothing unvalidated is saved.
- All HTML is passed through a strict allow-list sanitiser before it is stored. Mermaid is checked on the server, then parsed in the browser before rendering (`securityLevel: "strict"`).
- Every call (success or failure, tokens, duration) is written to `x_hai_ai_generation_log`, visible in **Admin → AI Activity**.

## 4. Limits
- **Per-user rate limit:** `AI_RATE_LIMIT_PER_MINUTE` (default 10) per server instance. Add a Vercel Firewall rule for a global limit (see VERCEL_DEPLOYMENT.md).
- **Groq account limits:** free and on-demand tiers have tokens-per-minute caps. A full 23-section document uses roughly 5 calls and 25–40k tokens. If Groq answers `429`, users see *"Groq rate limit reached. Please wait a minute."* Upgrade your Groq plan for heavier use.
- **Input size:** reference uploads add up to 15,000 characters of context per call.

## 5. Test
**Admin → Settings → Send test request** makes a real, tiny Groq call and shows the latency and model.

## 6. Data handling
Module configuration and upload extracts are sent to Groq to generate documents. Check your organisation's AI and data policy before using real production configuration, and tell users not to paste secrets, passwords or personal data into the form.
