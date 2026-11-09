import type { TableStore } from "@/lib/store/types";
import { tableName, toRecord, toSnDate, type TableKey } from "@/lib/servicenow/schema";
import { AI_SECTIONS, ALL_SECTION_KEYS } from "@/lib/documents/sections";
import type { DocContent, DocState, ModuleConfigInput } from "@/types";

/**
 * Realistic SAMPLE records for Demo Mode. Sample documents are clearly marked as
 * sample content — they are not presented as AI output.
 */
const PREFIX = "x_hai";
const t = (k: TableKey) => tableName(k, PREFIX);

function daysAgo(n: number, hour = 10) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return toSnDate(d.toISOString());
}

function sampleContent(moduleName: string): DocContent {
  return {
    sections: AI_SECTIONS.map((s) => ({
      key: s.key,
      title: s.title,
      status: "ok" as const,
      html: `<p><em>Sample content (demo data, not AI-generated).</em> This section would describe the ${s.title.toLowerCase()} of the ${moduleName} module. Generate a real document from a request to see Groq output.</p>`,
    })),
  };
}

const SAMPLE_MERMAID = `flowchart TD
  A([Start]) --> B[Employee submits request]
  B --> C{Category?}
  C -->|Hardware| D[Assign: Desktop Support]
  C -->|Software| E[Assign: Application Support]
  D --> F{Approval required?}
  E --> F
  F -->|Yes| G[Manager approval]
  F -->|No| H[Direct processing]
  G -->|Approved| H
  G -->|Rejected| I[Notify requester]
  H --> J([End])
  I --> J`;

export async function seedDemoData(store: TableStore) {
  const ins = async (k: TableKey, entity: Record<string, unknown>, created: string, id?: string) =>
    store.create(t(k), { ...toRecord(k, entity), sys_created_on: created, sys_updated_on: created, ...(id ? { sys_id: id } : {}) });

  const people = [
    ["emp_priya", "priya.sharma", "Priya Sharma", "IT Service Management", "ServiceNow Developer", "employee"],
    ["emp_rahul", "rahul.verma", "Rahul Verma", "HR Technology", "Platform Analyst", "employee"],
    ["emp_ananya", "ananya.iyer", "Ananya Iyer", "IT Service Management", "Senior Developer", "employee"],
    ["emp_karan", "karan.mehta", "Karan Mehta", "Finance Systems", "Business Analyst", "employee"],
    ["adm_meera", "meera.nair", "Meera Nair", "Platform Governance", "Platform Owner", "admin"],
  ] as const;
  const ids: Record<string, string> = {};
  for (const [i, [key, userName, fullName, department, jobTitle, role]] of people.entries()) {
    const r = await ins(
      "employee_profile",
      { userName, fullName, email: `${userName}@example.com`, department, jobTitle, role, active: true },
      daysAgo(200 - i),
      key.padEnd(32, "0").slice(0, 32)
    );
    ids[key] = r.sys_id;
  }

  const tplStd = await ins(
    "document_template",
    {
      name: "Standard Module Handover",
      documentType: "Technical Handover",
      description: "Full 26-section handover document for a ServiceNow module.",
      sections: ALL_SECTION_KEYS,
      instructions: "Write for a new administrator who has general ServiceNow knowledge but has never seen this module.",
      manualEffortHours: 16,
      active: true,
    },
    daysAgo(190)
  );
  await ins(
    "document_template",
    {
      name: "Quick KT Summary",
      documentType: "KT Summary",
      description: "Shorter knowledge-transfer summary for small modules.",
      sections: ["executive_summary", "module_overview", "categories", "business_rules", "workflow_routing", "assignment_groups", "troubleshooting", "handover_checklist"],
      instructions: "Keep each section brief and practical.",
      manualEffortHours: 6,
      active: true,
    },
    daysAgo(150)
  );

  const projects = [
    ["IT Service Desk Modernisation", "PRJ-1001", "ServiceNow ITSM", "IT Service Management", ids.emp_priya, "active"],
    ["HR Case Management Rollout", "PRJ-1002", "ServiceNow HRSD", "HR Technology", ids.emp_rahul, "active"],
    ["Finance Procurement Workflows", "PRJ-1003", "Procurement Portal", "Finance Systems", ids.emp_karan, "on_hold"],
    ["Major Incident Process", "PRJ-1004", "ServiceNow ITSM", "IT Service Management", ids.emp_ananya, "completed"],
  ] as const;
  const pids: string[] = [];
  for (const [i, [name, projectCode, applicationName, department, ownerId, status]] of projects.entries()) {
    const r = await ins(
      "project",
      { name, projectCode, applicationName, department, ownerId, status, description: `${name} — sample project for demo mode.` },
      daysAgo(180 - i * 10)
    );
    pids.push(r.sys_id);
  }

  const incidentConfig: ModuleConfigInput = {
    businessPurpose: "Restore normal service operation as quickly as possible after an unplanned interruption.",
    moduleFunctionality: "Employees raise incidents via the portal or email. Incidents are categorised, prioritised and routed to support groups.",
    categories: [
      { name: "Hardware", subcategories: "Laptop, Monitor, Printer" },
      { name: "Software", subcategories: "Email, VPN, Office Suite" },
      { name: "Network", subcategories: "Wi-Fi, LAN" },
    ],
    businessRules: [
      { name: "Set priority from impact and urgency", description: "Calculates priority using the priority lookup matrix.", condition: "Before insert/update when impact or urgency changes" },
      { name: "Auto-assign VPN incidents", description: "Routes VPN incidents to Network L2.", condition: "category=Software AND subcategory=VPN" },
    ],
    assignmentGroups: [
      { name: "Desktop Support", condition: "category = Hardware" },
      { name: "Application Support", condition: "category = Software" },
      { name: "Network L2", condition: "subcategory = VPN or category = Network" },
    ],
    routingLogic: "Assignment rules run in order. VPN incidents go to Network L2; other software incidents go to Application Support.",
    approvalProcess: "No approval for incidents. P1 incidents notify the Major Incident Manager.",
    tableNames: "incident, task",
    notifications: "Incident assigned to group; Incident resolved (to caller).",
    escalationRules: "P1 not acknowledged in 15 minutes escalates to the duty manager.",
  };

  const configs = [
    [pids[0], "Incident Management", "Priya Sharma", "IT Service Management", "Technical Handover", incidentConfig],
    [pids[1], "HR Case Routing", "Rahul Verma", "HR Technology", "KT Summary", { businessPurpose: "Route HR cases to the right HR specialist team." } as ModuleConfigInput],
    [pids[3], "Major Incident Workbench", "Ananya Iyer", "IT Service Management", "Technical Handover", { businessPurpose: "Coordinate P1 incidents." } as ModuleConfigInput],
    [pids[2], "Purchase Requisition Approval", "Karan Mehta", "Finance Systems", "Technical Handover", { businessPurpose: "Approve purchase requisitions by value." } as ModuleConfigInput],
  ] as const;

  const docs: [number, string, DocState, number, string][] = [
    // [configIndex, author, state, daysAgo, title]
    [0, ids.emp_priya, "draft", 1, "Incident Management — Technical Handover"],
    [1, ids.emp_rahul, "under_review", 6, "HR Case Routing — KT Summary"],
    [2, ids.emp_ananya, "published", 40, "Major Incident Workbench — Technical Handover"],
    [3, ids.emp_karan, "changes_requested", 12, "Purchase Requisition Approval — Handover"],
    [2, ids.emp_ananya, "approved", 75, "Major Incident Escalations — Handover"],
    [0, ids.emp_priya, "published", 110, "Incident Categorisation — Handover"],
  ];

  for (const [ci, author, state, ago, title] of docs) {
    const [projectId, moduleName, moduleOwner, businessDepartment, documentType, cfg] = configs[ci];
    const created = daysAgo(ago);
    const mc = await ins("module_configuration", { projectId, moduleName, moduleOwner, businessDepartment, documentType, description: `${moduleName} module`, config: cfg }, created);
    const req = await ins(
      "document_request",
      { projectId, moduleConfigId: mc.sys_id, requestedBy: author, title, documentType, templateId: tplStd.sys_id, state: state === "draft" ? "open" : "generated", referenceText: "" },
      created
    );
    if (state === "draft") continue; // the draft request has not been generated yet
    const submitted = ["under_review", "changes_requested", "approved", "published"].includes(state) ? daysAgo(ago - 1) : "";
    const approved = ["approved", "published"].includes(state) ? daysAgo(Math.max(ago - 3, 0)) : "";
    const doc = await ins(
      "generated_document",
      {
        requestId: req.sys_id,
        projectId,
        authorId: author,
        title,
        state,
        currentVersion: 1,
        content: sampleContent(moduleName),
        mermaid: SAMPLE_MERMAID,
        analysis: { summary: "Sample analysis (demo data).", missingInformation: [], conflicts: [], suggestions: [] },
        generationSeconds: 70 + ago,
        estimatedHoursSaved: 14.5,
        submittedAt: submitted ? new Date(submitted.replace(" ", "T") + "Z").toISOString() : "",
        approvedAt: approved ? new Date(approved.replace(" ", "T") + "Z").toISOString() : "",
        publishedAt: state === "published" && approved ? new Date(approved.replace(" ", "T") + "Z").toISOString() : "",
      },
      created
    );
    await ins("document_version", { documentId: doc.sys_id, versionNumber: 1, content: sampleContent(moduleName), mermaid: SAMPLE_MERMAID, changeSummary: "Sample version (demo data)", createdBy: author }, created);
    if (submitted) await ins("document_approval", { documentId: doc.sys_id, versionNumber: 1, actorId: author, action: "submitted", comments: "Ready for review." }, submitted);
    if (state === "changes_requested")
      await ins("document_approval", { documentId: doc.sys_id, versionNumber: 1, actorId: ids.adm_meera, action: "changes_requested", comments: "Please add the approval thresholds for requisitions above 50,000." }, daysAgo(ago - 2));
    if (approved) await ins("document_approval", { documentId: doc.sys_id, versionNumber: 1, actorId: ids.adm_meera, action: "approved", comments: "Looks complete." }, approved);
    if (state === "published") await ins("document_approval", { documentId: doc.sys_id, versionNumber: 1, actorId: ids.adm_meera, action: "published", comments: "" }, approved);
    await ins(
      "ai_generation_log",
      { operation: "generate-document", model: "sample-data", requestId: req.sys_id, documentId: doc.sys_id, userId: author, promptTokens: 0, completionTokens: 0, durationMs: (70 + ago) * 1000, status: "success", errorMessage: "Sample log entry (demo data)" },
      created
    );
  }
}
