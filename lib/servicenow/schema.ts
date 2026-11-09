/**
 * Single source of truth for the ServiceNow tables used by HandoverAI.
 * SERVICE_NOW_SETUP.md is generated from this file (npm run schema:docs),
 * so the setup guide and the code can never drift apart.
 */
export type FieldType = "string" | "number" | "decimal" | "boolean" | "json" | "reference" | "datetime" | "choice";

export interface FieldSpec {
  column: string;
  label: string;
  type: FieldType;
  maxLength?: number;
  reference?: TableKey;
  choices?: string[];
  mandatory?: boolean;
  indexed?: boolean;
}

export type TableKey =
  | "project"
  | "module_configuration"
  | "document_request"
  | "generated_document"
  | "document_version"
  | "document_approval"
  | "employee_profile"
  | "document_template"
  | "ai_generation_log";

export const DOC_STATES = [
  "draft",
  "ai_generated",
  "under_review",
  "changes_requested",
  "rejected",
  "approved",
  "published",
];

export const TABLES: Record<TableKey, { label: string; autoNumber?: string; fields: Record<string, FieldSpec> }> = {
  employee_profile: {
    label: "Employee Profile",
    fields: {
      userName: { column: "user_name", label: "User Name", type: "string", maxLength: 100, mandatory: true, indexed: true },
      fullName: { column: "full_name", label: "Full Name", type: "string", maxLength: 200, mandatory: true },
      email: { column: "email", label: "Email", type: "string", maxLength: 200 },
      department: { column: "department", label: "Department", type: "string", maxLength: 100 },
      jobTitle: { column: "job_title", label: "Job Title", type: "string", maxLength: 100 },
      role: { column: "role", label: "Role", type: "choice", choices: ["employee", "admin"], mandatory: true },
      active: { column: "active", label: "Active", type: "boolean" },
    },
  },
  project: {
    label: "Project",
    fields: {
      name: { column: "name", label: "Name", type: "string", maxLength: 200, mandatory: true },
      projectCode: { column: "project_id", label: "Project ID", type: "string", maxLength: 50, indexed: true },
      applicationName: { column: "application_name", label: "Application Name", type: "string", maxLength: 200 },
      department: { column: "department", label: "Business Department", type: "string", maxLength: 100 },
      ownerId: { column: "owner", label: "Owner", type: "reference", reference: "employee_profile" },
      description: { column: "description", label: "Description", type: "string", maxLength: 4000 },
      status: { column: "status", label: "Status", type: "choice", choices: ["active", "on_hold", "completed"] },
    },
  },
  module_configuration: {
    label: "Module Configuration",
    fields: {
      projectId: { column: "project", label: "Project", type: "reference", reference: "project", mandatory: true, indexed: true },
      moduleName: { column: "module_name", label: "Module Name", type: "string", maxLength: 200, mandatory: true },
      moduleOwner: { column: "module_owner", label: "Module Owner", type: "string", maxLength: 200 },
      businessDepartment: { column: "business_department", label: "Business Department", type: "string", maxLength: 100 },
      documentType: { column: "document_type", label: "Document Type", type: "string", maxLength: 100 },
      description: { column: "description", label: "Description", type: "string", maxLength: 4000 },
      config: { column: "config_json", label: "Configuration (JSON)", type: "json", maxLength: 1000000 },
    },
  },
  document_request: {
    label: "Document Request",
    autoNumber: "HDR",
    fields: {
      number: { column: "number", label: "Number", type: "string", maxLength: 40 },
      projectId: { column: "project", label: "Project", type: "reference", reference: "project", indexed: true },
      moduleConfigId: { column: "module_configuration", label: "Module Configuration", type: "reference", reference: "module_configuration" },
      requestedBy: { column: "requested_by", label: "Requested By", type: "reference", reference: "employee_profile", indexed: true },
      title: { column: "title", label: "Title", type: "string", maxLength: 200 },
      documentType: { column: "document_type", label: "Document Type", type: "string", maxLength: 100 },
      templateId: { column: "template", label: "Template", type: "reference", reference: "document_template" },
      state: { column: "state", label: "State", type: "choice", choices: ["open", "generated", "closed"] },
      referenceText: { column: "reference_text", label: "Reference Text (from uploads)", type: "string", maxLength: 100000 },
    },
  },
  generated_document: {
    label: "Generated Document",
    fields: {
      requestId: { column: "document_request", label: "Document Request", type: "reference", reference: "document_request", indexed: true },
      projectId: { column: "project", label: "Project", type: "reference", reference: "project", indexed: true },
      authorId: { column: "author", label: "Author", type: "reference", reference: "employee_profile", indexed: true },
      title: { column: "title", label: "Title", type: "string", maxLength: 200 },
      state: { column: "state", label: "State", type: "choice", choices: DOC_STATES, indexed: true },
      currentVersion: { column: "current_version", label: "Current Version", type: "number" },
      content: { column: "content_json", label: "Content (JSON)", type: "json", maxLength: 1000000 },
      mermaid: { column: "mermaid_code", label: "Mermaid Code", type: "string", maxLength: 20000 },
      analysis: { column: "analysis_json", label: "Analysis (JSON)", type: "json", maxLength: 65000 },
      generationSeconds: { column: "generation_seconds", label: "Generation Seconds", type: "number" },
      estimatedHoursSaved: { column: "estimated_hours_saved", label: "Estimated Hours Saved", type: "decimal" },
      submittedAt: { column: "submitted_on", label: "Submitted On", type: "datetime" },
      approvedAt: { column: "approved_on", label: "Approved On", type: "datetime" },
      publishedAt: { column: "published_on", label: "Published On", type: "datetime" },
    },
  },
  document_version: {
    label: "Document Version",
    fields: {
      documentId: { column: "generated_document", label: "Generated Document", type: "reference", reference: "generated_document", mandatory: true, indexed: true },
      versionNumber: { column: "version_number", label: "Version Number", type: "number" },
      content: { column: "content_json", label: "Content (JSON)", type: "json", maxLength: 1000000 },
      mermaid: { column: "mermaid_code", label: "Mermaid Code", type: "string", maxLength: 20000 },
      changeSummary: { column: "change_summary", label: "Change Summary", type: "string", maxLength: 1000 },
      createdBy: { column: "created_by_profile", label: "Created By", type: "reference", reference: "employee_profile" },
    },
  },
  document_approval: {
    label: "Document Approval",
    fields: {
      documentId: { column: "generated_document", label: "Generated Document", type: "reference", reference: "generated_document", mandatory: true, indexed: true },
      versionNumber: { column: "version_number", label: "Version Number", type: "number" },
      actorId: { column: "actor", label: "Actor", type: "reference", reference: "employee_profile" },
      action: { column: "action", label: "Action", type: "choice", choices: ["submitted", "approved", "rejected", "changes_requested", "published", "comment"] },
      comments: { column: "comments", label: "Comments", type: "string", maxLength: 4000 },
    },
  },
  document_template: {
    label: "Document Template",
    fields: {
      name: { column: "name", label: "Name", type: "string", maxLength: 200, mandatory: true },
      documentType: { column: "document_type", label: "Document Type", type: "string", maxLength: 100 },
      description: { column: "description", label: "Description", type: "string", maxLength: 1000 },
      sections: { column: "sections_json", label: "Sections (JSON array of keys)", type: "json", maxLength: 4000 },
      instructions: { column: "instructions", label: "AI Instructions", type: "string", maxLength: 4000 },
      manualEffortHours: { column: "manual_effort_hours", label: "Manual Effort (hours)", type: "decimal" },
      active: { column: "active", label: "Active", type: "boolean" },
    },
  },
  ai_generation_log: {
    label: "AI Generation Log",
    fields: {
      operation: { column: "operation", label: "Operation", type: "string", maxLength: 60, indexed: true },
      model: { column: "model", label: "Model", type: "string", maxLength: 100 },
      requestId: { column: "document_request", label: "Document Request", type: "reference", reference: "document_request" },
      documentId: { column: "generated_document", label: "Generated Document", type: "reference", reference: "generated_document" },
      userId: { column: "user", label: "User", type: "reference", reference: "employee_profile", indexed: true },
      promptTokens: { column: "prompt_tokens", label: "Prompt Tokens", type: "number" },
      completionTokens: { column: "completion_tokens", label: "Completion Tokens", type: "number" },
      durationMs: { column: "duration_ms", label: "Duration (ms)", type: "number" },
      status: { column: "status", label: "Status", type: "choice", choices: ["success", "error"] },
      errorMessage: { column: "error_message", label: "Error Message", type: "string", maxLength: 4000 },
    },
  },
};

export function tableName(key: TableKey, prefix: string): string {
  return `${prefix}_${key}`;
}

export type RawRecord = Record<string, string>;

/** Convert a raw ServiceNow-style record into an entity using the table spec. */
export function fromRecord<T>(key: TableKey, r: RawRecord): T {
  const out: Record<string, unknown> = {
    id: r.sys_id,
    createdAt: toIso(r.sys_created_on),
    updatedAt: toIso(r.sys_updated_on),
  };
  for (const [prop, f] of Object.entries(TABLES[key].fields)) {
    const v = r[f.column] ?? "";
    switch (f.type) {
      case "number":
      case "decimal":
        out[prop] = v === "" ? 0 : Number(v);
        break;
      case "boolean":
        out[prop] = v === "true" || v === "1";
        break;
      case "json":
        out[prop] = parseJson(v);
        break;
      case "datetime":
        out[prop] = toIso(v);
        break;
      default:
        out[prop] = v;
    }
  }
  return out as T;
}

/** Convert a partial entity into raw ServiceNow field values. Unknown props are ignored. */
export function toRecord(key: TableKey, entity: Record<string, unknown>): RawRecord {
  const out: RawRecord = {};
  for (const [prop, f] of Object.entries(TABLES[key].fields)) {
    if (!(prop in entity)) continue;
    const v = entity[prop];
    if (v === undefined) continue;
    switch (f.type) {
      case "json":
        out[f.column] = v === null ? "" : JSON.stringify(v);
        break;
      case "boolean":
        out[f.column] = v ? "true" : "false";
        break;
      case "datetime":
        out[f.column] = v ? toSnDate(String(v)) : "";
        break;
      default:
        out[f.column] = v === null ? "" : String(v);
    }
    if (f.maxLength && out[f.column].length > f.maxLength) {
      throw new Error(`Field "${f.label}" exceeds the ServiceNow maximum length of ${f.maxLength} characters.`);
    }
  }
  return out;
}

function parseJson(v: string): unknown {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** ServiceNow returns "YYYY-MM-DD HH:mm:ss" in UTC when sysparm_display_value=false. */
export function toIso(v: string | undefined): string {
  if (!v) return "";
  if (v.includes("T")) return v;
  return v.replace(" ", "T") + "Z";
}

export function toSnDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Map an entity property name to its ServiceNow column, for queries. */
export function column(key: TableKey, prop: string): string {
  if (prop === "id") return "sys_id";
  if (prop === "createdAt") return "sys_created_on";
  if (prop === "updatedAt") return "sys_updated_on";
  const f = TABLES[key].fields[prop];
  if (!f) throw new Error(`Unknown field ${prop} on ${key}`);
  return f.column;
}
