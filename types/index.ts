export type Role = "employee" | "admin";

export type DocState =
  | "draft"
  | "ai_generated"
  | "under_review"
  | "changes_requested"
  | "rejected"
  | "approved"
  | "published";

export interface EmployeeProfile {
  id: string;
  userName: string;
  fullName: string;
  email: string;
  department: string;
  jobTitle: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  projectCode: string;
  applicationName: string;
  department: string;
  ownerId: string;
  description: string;
  status: "active" | "on_hold" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface NamedItem {
  name: string;
  description?: string;
  condition?: string;
}

export interface CategoryItem {
  name: string;
  subcategories?: string;
}

export interface ApprovalStageItem {
  name: string;
  approver?: string;
  condition?: string;
}

/** Everything the employee types into the multi-section form (sections B–E). */
export interface ModuleConfigInput {
  // B: Module configuration
  businessPurpose?: string;
  moduleFunctionality?: string;
  categories?: CategoryItem[];
  configurationDetails?: string;
  businessRules?: NamedItem[];
  conditions?: string;
  assignmentGroups?: NamedItem[];
  routingLogic?: string;
  approvalProcess?: string;
  approvalStages?: ApprovalStageItem[];
  rolesAndPermissions?: string;
  // C: Technical
  tableNames?: string;
  fieldNames?: string;
  scriptDetails?: string;
  businessRuleNames?: string;
  clientScripts?: string;
  serverScripts?: string;
  scheduledJobs?: string;
  integrations?: string;
  apiDetails?: string;
  notifications?: string;
  dependencies?: string;
  // D: Workflow
  workflowName?: string;
  triggerConditions?: string;
  startCondition?: string;
  decisionConditions?: string;
  assignmentConditions?: string;
  escalationRules?: string;
  completionConditions?: string;
  exceptionHandling?: string;
  // E: Additional
  knownIssues?: string;
  limitations?: string;
  troubleshootingDetails?: string;
  testingScenarios?: string;
  additionalNotes?: string;
}

export interface ModuleConfiguration {
  id: string;
  projectId: string;
  moduleName: string;
  moduleOwner: string;
  businessDepartment: string;
  documentType: string;
  description: string;
  config: ModuleConfigInput;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRequest {
  id: string;
  number: string;
  projectId: string;
  moduleConfigId: string;
  requestedBy: string;
  title: string;
  documentType: string;
  templateId: string;
  state: "open" | "generated" | "closed";
  referenceText: string;
  createdAt: string;
  updatedAt: string;
}

export type SectionStatus = "ok" | "information_required" | "conflict";

export interface DocSection {
  key: string;
  title: string;
  html: string;
  status: SectionStatus;
}

export interface DocContent {
  sections: DocSection[];
}

export interface AnalysisResult {
  summary: string;
  missingInformation: { field: string; reason: string }[];
  conflicts: { description: string; items: string[] }[];
  suggestions: string[];
}

export interface GeneratedDocument {
  id: string;
  requestId: string;
  projectId: string;
  authorId: string;
  title: string;
  state: DocState;
  currentVersion: number;
  content: DocContent;
  mermaid: string;
  analysis: AnalysisResult | null;
  generationSeconds: number;
  estimatedHoursSaved: number;
  submittedAt: string;
  approvedAt: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  content: DocContent;
  mermaid: string;
  changeSummary: string;
  createdBy: string;
  createdAt: string;
}

export type ApprovalAction =
  | "submitted"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "published"
  | "comment";

export interface DocumentApproval {
  id: string;
  documentId: string;
  versionNumber: number;
  actorId: string;
  action: ApprovalAction;
  comments: string;
  createdAt: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  documentType: string;
  description: string;
  sections: string[];
  instructions: string;
  manualEffortHours: number;
  active: boolean;
  createdAt: string;
}

export interface AiGenerationLog {
  id: string;
  operation: string;
  model: string;
  requestId: string;
  documentId: string;
  userId: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  status: "success" | "error";
  errorMessage: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  userName: string;
  fullName: string;
  role: Role;
}

export type DataMode = "servicenow" | "demo" | "unconfigured";
