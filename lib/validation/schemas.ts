import { z } from "zod";

export const id = z.string().regex(/^[A-Za-z0-9_]{1,40}$/, "Invalid id");
const text = (max = 8000) => z.string().trim().max(max).optional().default("");
const optText = (max = 8000) => z.string().trim().max(max).optional();

const namedItem = z.object({
  name: z.string().trim().max(200),
  description: optText(2000),
  condition: optText(2000),
});

export const moduleConfigInput = z
  .object({
    businessPurpose: optText(),
    moduleFunctionality: optText(),
    categories: z.array(z.object({ name: z.string().trim().max(200), subcategories: optText(2000) })).max(100).optional(),
    configurationDetails: optText(),
    businessRules: z.array(namedItem).max(100).optional(),
    conditions: optText(),
    assignmentGroups: z.array(namedItem).max(100).optional(),
    routingLogic: optText(),
    approvalProcess: optText(),
    approvalStages: z
      .array(z.object({ name: z.string().trim().max(200), approver: optText(200), condition: optText(2000) }))
      .max(50)
      .optional(),
    rolesAndPermissions: optText(),
    tableNames: optText(),
    fieldNames: optText(),
    scriptDetails: optText(20000),
    businessRuleNames: optText(),
    clientScripts: optText(20000),
    serverScripts: optText(20000),
    scheduledJobs: optText(),
    integrations: optText(),
    apiDetails: optText(),
    notifications: optText(),
    dependencies: optText(),
    workflowName: optText(500),
    triggerConditions: optText(),
    startCondition: optText(),
    decisionConditions: optText(),
    assignmentConditions: optText(),
    escalationRules: optText(),
    completionConditions: optText(),
    exceptionHandling: optText(),
    knownIssues: optText(),
    limitations: optText(),
    troubleshootingDetails: optText(),
    testingScenarios: optText(),
    additionalNotes: optText(),
  })
  .strict()
  .transform((v) => {
    // Drop empty list rows so the AI never sees blank items.
    const clean = <T extends { name: string }>(a?: T[]) => a?.filter((x) => x.name.trim() !== "");
    return {
      ...v,
      categories: clean(v.categories),
      businessRules: clean(v.businessRules),
      assignmentGroups: clean(v.assignmentGroups),
      approvalStages: clean(v.approvalStages),
    };
  });

export const projectInput = z.object({
  name: z.string().trim().min(2).max(200),
  projectCode: text(50),
  applicationName: text(200),
  department: text(100),
  description: text(4000),
  status: z.enum(["active", "on_hold", "completed"]).optional().default("active"),
  ownerId: id.optional(),
});

export const requestInput = z.object({
  project: z.union([
    z.object({ existingId: id }),
    z.object({ create: projectInput }),
  ]),
  moduleName: z.string().trim().min(2, "Module name is required").max(200),
  moduleOwner: text(200),
  businessDepartment: text(100),
  documentType: z.string().trim().min(2).max(100),
  description: text(4000),
  templateId: id.optional(),
  config: moduleConfigInput,
});

export const requestUpdate = requestInput.partial().extend({ project: requestInput.shape.project.optional() });

const sectionSchema = z.object({
  key: z.string().regex(/^[a-z_]{2,60}$/),
  title: z.string().trim().min(1).max(200),
  html: z.string().max(200000),
  status: z.enum(["ok", "information_required", "conflict"]),
});

export const documentContent = z.object({ sections: z.array(sectionSchema).min(1).max(60) });

export const documentPatch = z.object({
  content: documentContent.optional(),
  mermaid: z.string().max(20000).optional(),
  title: z.string().trim().min(2).max(200).optional(),
  saveVersion: z.boolean().optional(),
  changeSummary: z.string().trim().max(1000).optional(),
});

export const reviewInput = z.object({
  action: z.enum(["approved", "rejected", "changes_requested", "comment"]),
  comments: z.string().trim().max(4000).optional().default(""),
}).refine((v) => v.action === "approved" || v.comments.length > 0, {
  message: "Comments are required when rejecting, requesting changes or commenting.",
  path: ["comments"],
});

export const employeeInput = z.object({
  userName: z.string().trim().min(2).max(100).regex(/^[A-Za-z0-9._@-]+$/, "Letters, numbers and . _ @ - only"),
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(200).or(z.literal("")).optional().default(""),
  department: text(100),
  jobTitle: text(100),
  role: z.enum(["employee", "admin"]),
  active: z.boolean().optional().default(true),
});

export const templateInput = z.object({
  name: z.string().trim().min(2).max(200),
  documentType: z.string().trim().min(2).max(100),
  description: text(1000),
  sections: z.array(z.string().regex(/^[a-z_]{2,60}$/)).min(1).max(60),
  instructions: text(4000),
  manualEffortHours: z.number().min(0).max(500),
  active: z.boolean().optional().default(true),
});

export const loginInput = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const chatInput = z.object({
  documentId: id.optional(),
  requestId: id.optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(8000) }))
    .min(1)
    .max(30),
});
