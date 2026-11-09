# ServiceNow Setup Guide

HandoverAI uses ServiceNow as its **primary database**. Every project, request, document, version, approval, employee profile, template and AI log is a record in a custom table in your instance. Reference uploads are stored with the **Attachment API**. The Next.js server talks to ServiceNow over REST with OAuth 2.0. The browser never talks to ServiceNow directly.

Follow these steps on a **development** instance first (a free Personal Developer Instance works).

---

## 1. Create the scoped application

1. Open **System Applications → Studio** (or **App Engine Studio**) → **Create Application**.
2. Name: `HandoverAI`. ServiceNow assigns the scope, for example `x_hai` on some instances, or `x_<vendor>_hai` (such as `x_12345_hai`) on most.
3. Note the scope. Tables in a scoped app are named `<scope>_<table>`, so set **`SERVICENOW_TABLE_PREFIX`** to your scope (for example `x_12345_hai`). The guide below uses the default `x_hai`.

## 2. Create the nine tables

Create each table in the HandoverAI scope (**Studio → Create Application File → Table**). For every table:

- Leave **Extends table** empty.
- Untick **Create module** and **Create mobile module** (the app has its own UI).
- On the **Application Access** tab, tick **Allow access to this table via web services**, and set **Accessible from** to *This application scope only*.
- Add the columns exactly as listed below. Column *names* must match; labels are free.
- **String (JSON)** columns are plain *String* columns that hold JSON. Set the max length shown; values above 4,000 characters are stored as long text.
- For **Choice** columns, add the choice values listed (value = label is fine).
- **Index** = add a database index on that column (**Table → Database Indexes → New**). This keeps list queries fast.

`sys_id`, `sys_created_on` and `sys_updated_on` are added automatically and are used by the app.

> These definitions are generated from `lib/servicenow/schema.ts` (`npm run schema:docs`), so they always match the code.

### 1. Employee Profile — `x_hai_employee_profile`

| Column label | Column name | Type | Max length | Reference / Choices | Mandatory | Index |
|---|---|---|---|---|---|---|
| User Name | `user_name` | String | 100 |  | Yes | Yes |
| Full Name | `full_name` | String | 200 |  | Yes |  |
| Email | `email` | String | 200 |  |  |  |
| Department | `department` | String | 100 |  |  |  |
| Job Title | `job_title` | String | 100 |  |  |  |
| Role | `role` | Choice |  | `employee`, `admin` | Yes |  |
| Active | `active` | True/False |  |  |  |  |

### 2. Project — `x_hai_project`

| Column label | Column name | Type | Max length | Reference / Choices | Mandatory | Index |
|---|---|---|---|---|---|---|
| Name | `name` | String | 200 |  | Yes |  |
| Project ID | `project_id` | String | 50 |  |  | Yes |
| Application Name | `application_name` | String | 200 |  |  |  |
| Business Department | `department` | String | 100 |  |  |  |
| Owner | `owner` | Reference |  | `x_hai_employee_profile` |  |  |
| Description | `description` | String | 4000 |  |  |  |
| Status | `status` | Choice |  | `active`, `on_hold`, `completed` |  |  |

### 3. Module Configuration — `x_hai_module_configuration`

| Column label | Column name | Type | Max length | Reference / Choices | Mandatory | Index |
|---|---|---|---|---|---|---|
| Project | `project` | Reference |  | `x_hai_project` | Yes | Yes |
| Module Name | `module_name` | String | 200 |  | Yes |  |
| Module Owner | `module_owner` | String | 200 |  |  |  |
| Business Department | `business_department` | String | 100 |  |  |  |
| Document Type | `document_type` | String | 100 |  |  |  |
| Description | `description` | String | 4000 |  |  |  |
| Configuration (JSON) | `config_json` | String (JSON) | 1000000 |  |  |  |

### 4. Document Request — `x_hai_document_request`

Auto-number: prefix **HDR**, 7 digits (Table → Controls → Auto-number).

| Column label | Column name | Type | Max length | Reference / Choices | Mandatory | Index |
|---|---|---|---|---|---|---|
| Number | `number` | String | 40 |  |  |  |
| Project | `project` | Reference |  | `x_hai_project` |  | Yes |
| Module Configuration | `module_configuration` | Reference |  | `x_hai_module_configuration` |  |  |
| Requested By | `requested_by` | Reference |  | `x_hai_employee_profile` |  | Yes |
| Title | `title` | String | 200 |  |  |  |
| Document Type | `document_type` | String | 100 |  |  |  |
| Template | `template` | Reference |  | `x_hai_document_template` |  |  |
| State | `state` | Choice |  | `open`, `generated`, `closed` |  |  |
| Reference Text (from uploads) | `reference_text` | String | 100000 |  |  |  |

### 5. Generated Document — `x_hai_generated_document`

| Column label | Column name | Type | Max length | Reference / Choices | Mandatory | Index |
|---|---|---|---|---|---|---|
| Document Request | `document_request` | Reference |  | `x_hai_document_request` |  | Yes |
| Project | `project` | Reference |  | `x_hai_project` |  | Yes |
| Author | `author` | Reference |  | `x_hai_employee_profile` |  | Yes |
| Title | `title` | String | 200 |  |  |  |
| State | `state` | Choice |  | `draft`, `ai_generated`, `under_review`, `changes_requested`, `rejected`, `approved`, `published` |  | Yes |
| Current Version | `current_version` | Integer |  |  |  |  |
| Content (JSON) | `content_json` | String (JSON) | 1000000 |  |  |  |
| Mermaid Code | `mermaid_code` | String | 20000 |  |  |  |
| Analysis (JSON) | `analysis_json` | String (JSON) | 65000 |  |  |  |
| Generation Seconds | `generation_seconds` | Integer |  |  |  |  |
| Estimated Hours Saved | `estimated_hours_saved` | Decimal |  |  |  |  |
| Submitted On | `submitted_on` | Date/Time |  |  |  |  |
| Approved On | `approved_on` | Date/Time |  |  |  |  |
| Published On | `published_on` | Date/Time |  |  |  |  |

### 6. Document Version — `x_hai_document_version`

| Column label | Column name | Type | Max length | Reference / Choices | Mandatory | Index |
|---|---|---|---|---|---|---|
| Generated Document | `generated_document` | Reference |  | `x_hai_generated_document` | Yes | Yes |
| Version Number | `version_number` | Integer |  |  |  |  |
| Content (JSON) | `content_json` | String (JSON) | 1000000 |  |  |  |
| Mermaid Code | `mermaid_code` | String | 20000 |  |  |  |
| Change Summary | `change_summary` | String | 1000 |  |  |  |
| Created By | `created_by_profile` | Reference |  | `x_hai_employee_profile` |  |  |

### 7. Document Approval — `x_hai_document_approval`

| Column label | Column name | Type | Max length | Reference / Choices | Mandatory | Index |
|---|---|---|---|---|---|---|
| Generated Document | `generated_document` | Reference |  | `x_hai_generated_document` | Yes | Yes |
| Version Number | `version_number` | Integer |  |  |  |  |
| Actor | `actor` | Reference |  | `x_hai_employee_profile` |  |  |
| Action | `action` | Choice |  | `submitted`, `approved`, `rejected`, `changes_requested`, `published`, `comment` |  |  |
| Comments | `comments` | String | 4000 |  |  |  |

### 8. Document Template — `x_hai_document_template`

| Column label | Column name | Type | Max length | Reference / Choices | Mandatory | Index |
|---|---|---|---|---|---|---|
| Name | `name` | String | 200 |  | Yes |  |
| Document Type | `document_type` | String | 100 |  |  |  |
| Description | `description` | String | 1000 |  |  |  |
| Sections (JSON array of keys) | `sections_json` | String (JSON) | 4000 |  |  |  |
| AI Instructions | `instructions` | String | 4000 |  |  |  |
| Manual Effort (hours) | `manual_effort_hours` | Decimal |  |  |  |  |
| Active | `active` | True/False |  |  |  |  |

### 9. AI Generation Log — `x_hai_ai_generation_log`

| Column label | Column name | Type | Max length | Reference / Choices | Mandatory | Index |
|---|---|---|---|---|---|---|
| Operation | `operation` | String | 60 |  |  | Yes |
| Model | `model` | String | 100 |  |  |  |
| Document Request | `document_request` | Reference |  | `x_hai_document_request` |  |  |
| Generated Document | `generated_document` | Reference |  | `x_hai_generated_document` |  |  |
| User | `user` | Reference |  | `x_hai_employee_profile` |  | Yes |
| Prompt Tokens | `prompt_tokens` | Integer |  |  |  |  |
| Completion Tokens | `completion_tokens` | Integer |  |  |  |  |
| Duration (ms) | `duration_ms` | Integer |  |  |  |  |
| Status | `status` | Choice |  | `success`, `error` |  |  |
| Error Message | `error_message` | String | 4000 |  |  |  |

(node:5130) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/handover-document-generator/lib/servicenow/schema.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/handover-document-generator/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
### Relationships

```
Project ─┬─< Module Configuration ─< Document Request ─< Generated Document ─┬─< Document Version
         │                                   │                               └─< Document Approval
         └───────────────────────────────────┘ (request.project)
Employee Profile ─< (owner, requested_by, author, actor, created_by_profile, user)
Document Template ─< Document Request
Document Request / Generated Document ─< AI Generation Log
Document Request ─< sys_attachment (reference uploads)
```

## 3. Roles and ACLs (least privilege)

The app uses **one integration user**. Users never get direct table access, and the app enforces employee/admin permissions on the server. Lock the integration user down to these tables only:

1. **Create a role:** `x_hai.integration` (in Studio: Create Application File → Role).
2. **Create ACLs** for every one of the nine tables (Studio → Create Application File → Access Control):

   | Operation | Name | Requires role |
   |---|---|---|
   | read | `x_hai_<table>` and `x_hai_<table>.*` | `x_hai.integration` |
   | create | `x_hai_<table>` and `x_hai_<table>.*` | `x_hai.integration` |
   | write | `x_hai_<table>` and `x_hai_<table>.*` | `x_hai.integration` |
   | delete | — (do not grant) | — |

   ServiceNow checks attachment access against the parent record, so `create`/`read` on `x_hai_document_request` also covers its attachments.

3. **Optional:** create `x_hai.admin` with read on all tables, for ServiceNow-side reporting by platform admins.

## 4. Integration user

1. **User Administration → Users → New**
   - User ID: `handoverai.integration`
   - Tick **Web service access only** (it cannot log in to the UI).
   - Set a strong password.
   - Roles: `x_hai.integration`, plus `snc_platform_rest_api_access` if your instance enforces REST API access policies.
2. Put the credentials in **`SERVICENOW_USERNAME`** and **`SERVICENOW_PASSWORD`**.

## 5. OAuth 2.0 client

1. **System OAuth → Application Registry → New → Create an OAuth API endpoint for external clients**.
2. Name: `HandoverAI (Vercel)`. Leave the Client Secret empty to auto-generate it. Set Access Token Lifespan to `1800` and Refresh Token Lifespan to `86400`.
3. Save, then copy the **Client ID** into `SERVICENOW_CLIENT_ID` and the **Client Secret** into `SERVICENOW_CLIENT_SECRET`.

How the app authenticates:

| Purpose | Grant | Notes |
|---|---|---|
| Server-to-server data access | `password` (integration user) | Token cached in server memory until 60 s before expiry, refreshed automatically, and retried once on a `401`. |
| *Alternative* | `client_credentials` | Used when `SERVICENOW_USERNAME`/`PASSWORD` are empty. Needs Washington DC or later: set the system property `glide.oauth.inbound.client.credential.grant_type.enabled = true`, and set **OAuth Application User** on the registry entry to the integration user. |
| **End-user sign-in** | `password` (user's own credentials) | The app checks the user's ServiceNow user name and password against `/oauth_token.do`. The user's token is **discarded immediately**; it is only proof of identity. |

> If your instance uses SSO only (no local passwords), end-user sign-in needs an SSO/OIDC provider in front of the app. See "Extending sign-in" in README.md.

## 6. Employee profiles (application roles)

A person can sign in only if **both** of these are true:
1. Their ServiceNow user name and password are valid.
2. An **active** record in `x_hai_employee_profile` has the same `user_name`.

The profile's `role` (`employee` or `admin`) decides portal access, and the server re-reads it every 60 s. Create the first admin by hand:

**`x_hai_employee_profile.list` → New:** User Name = *your ServiceNow user_name*, Full Name, Role = `admin`, Active = true.

After that, admins manage profiles in **HandoverAI → Admin → Employees**.

## 7. Seed a template (recommended)

**`x_hai_document_template.list` → New:**
- Name: `Standard Module Handover`; Document Type: `Technical Handover`; Manual Effort (hours): `16`; Active: true
- Sections (JSON): leave as `[]` to generate all 23 AI sections, or list keys such as `["executive_summary","module_overview","business_rules"]`. Admins can also create templates in the app (Admin → Templates).

## 8. Auditing (recommended)

Turn on auditing so ServiceNow records field changes for compliance. Set the dictionary attribute **`audit=true`** on each table's collection entry, or add the tables to `glide.ui.audit_tables` (depending on release). HandoverAI also writes its own trail to `x_hai_document_approval` (every submit, approve, reject, change request, comment and publish) and `x_hai_ai_generation_log` (every Groq call).

## 9. Verify the connection

1. Set the environment variables (see `.env.example`) and start the app.
2. Sign in as your admin and open **Admin → Settings**. Each of the nine tables should show a green tick.
3. Common errors:

| Message | Fix |
|---|---|
| `ServiceNow rejected the credentials` | Wrong client ID/secret or integration user password. |
| `ServiceNow API error (403)… Check the integration user's roles and the table ACLs` | Add the `x_hai.integration` role and the ACLs in step 3. |
| `… Has the table been created?` | Table missing, or `SERVICENOW_TABLE_PREFIX` doesn't match your scope. |
| `Field "…" exceeds the ServiceNow maximum length` | Increase the column's max length to the value in the tables above. |

## 10. Legacy Script Include endpoint (optional)

v1 exposed `POST /api/generate` for a ServiceNow Script Include (REST Message "KT Vercel", header `x-kt-secret`). It still works when `KT_SHARED_SECRET` is set; leave that variable empty to turn it off.
