/**
 * The 26-part handover document structure.
 * Parts 1–3 (cover page, document information, revision history) and the table of
 * contents are built from record metadata at export time. Parts 4–26 are AI-written.
 */
export interface SectionDef {
  key: string;
  title: string;
  /** What the AI should cover; also shown as helper text in the editor. */
  guidance: string;
  /** Form fields this section relies on (used for "Information Required" checks). */
  sources: string[];
}

export const META_SECTIONS = [
  { number: 1, title: "Cover Page" },
  { number: 2, title: "Document Information" },
  { number: 3, title: "Revision History" },
];

export const AI_SECTIONS: SectionDef[] = [
  { key: "executive_summary", title: "Executive Summary", guidance: "One-paragraph summary of the module, its purpose and the state of the handover.", sources: ["businessPurpose", "moduleFunctionality"] },
  { key: "project_overview", title: "Project Overview", guidance: "Project, application, department and owner context.", sources: [] },
  { key: "module_overview", title: "Module Overview", guidance: "What the module does and who uses it.", sources: ["moduleFunctionality"] },
  { key: "business_purpose", title: "Business Purpose", guidance: "Business problem solved and value delivered.", sources: ["businessPurpose"] },
  { key: "scope", title: "Scope of the Module", guidance: "In scope and out of scope items derived from the input.", sources: ["moduleFunctionality"] },
  { key: "functional_description", title: "Functional Description", guidance: "End-to-end functional behaviour in plain language.", sources: ["moduleFunctionality", "routingLogic"] },
  { key: "technical_architecture", title: "Technical Architecture", guidance: "Tables, fields, scripts and components, only as supplied.", sources: ["tableNames", "fieldNames", "scriptDetails"] },
  { key: "configuration_details", title: "Configuration Details", guidance: "Configuration items explained simply.", sources: ["configurationDetails"] },
  { key: "categories", title: "Categories and Subcategories", guidance: "HTML table of categories and their subcategories.", sources: ["categories"] },
  { key: "business_rules", title: "Business Rules", guidance: "HTML table: rule name, when it runs, condition, effect — plus plain-English explanation.", sources: ["businessRules", "businessRuleNames"] },
  { key: "workflow_routing", title: "Workflow and Routing Logic", guidance: "Step-by-step routing in evaluation order, including decisions and escalations.", sources: ["routingLogic", "workflowName", "triggerConditions", "decisionConditions"] },
  { key: "assignment_groups", title: "Assignment Group Details", guidance: "HTML table of assignment groups and when each receives work.", sources: ["assignmentGroups", "assignmentConditions"] },
  { key: "approval_process", title: "Approval Process", guidance: "Approval stages, approvers, conditions and rejection handling.", sources: ["approvalProcess", "approvalStages"] },
  { key: "roles_responsibilities", title: "Roles and Responsibilities", guidance: "Roles, permissions and who does what.", sources: ["rolesAndPermissions"] },
  { key: "integrations", title: "Integrations and Dependencies", guidance: "Integrations, APIs and dependencies exactly as supplied.", sources: ["integrations", "apiDetails", "dependencies"] },
  { key: "exception_handling", title: "Exception Handling", guidance: "Error paths, fallbacks and manual interventions.", sources: ["exceptionHandling"] },
  { key: "notifications", title: "Notifications", guidance: "Notifications, recipients and triggers.", sources: ["notifications"] },
  { key: "testing_scenarios", title: "Testing Scenarios", guidance: "HTML table of test cases: ID, scenario, steps, expected result.", sources: ["testingScenarios"] },
  { key: "troubleshooting", title: "Troubleshooting Guide", guidance: "HTML table: symptom, likely cause, resolution.", sources: ["troubleshootingDetails", "knownIssues"] },
  { key: "known_issues", title: "Known Issues", guidance: "Known issues and limitations.", sources: ["knownIssues", "limitations"] },
  { key: "faq", title: "Frequently Asked Questions", guidance: "6–10 practical Q&A pairs for a new owner.", sources: [] },
  { key: "handover_checklist", title: "Handover Checklist", guidance: "Checklist of access, knowledge sessions, open items and sign-off steps.", sources: [] },
  { key: "future_recommendations", title: "Future Recommendations", guidance: "Improvements based on gaps, conflicts and limitations found.", sources: [] },
];

export const ALL_SECTION_KEYS = AI_SECTIONS.map((s) => s.key);

export function sectionDef(key: string): SectionDef | undefined {
  return AI_SECTIONS.find((s) => s.key === key);
}

/** Document numbering: meta sections are 1–3, AI sections start at 4. */
export function sectionNumber(key: string, keys: string[] = ALL_SECTION_KEYS): number {
  return keys.indexOf(key) + META_SECTIONS.length + 1;
}

export const INFO_REQUIRED = "Information Required";
export const CONFLICT_DETECTED = "Configuration Conflict Detected";
