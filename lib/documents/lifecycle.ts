import type { DocState, Role } from "@/types";

export const STATE_LABELS: Record<DocState, string> = {
  draft: "Draft",
  ai_generated: "AI Generated",
  under_review: "Under Review",
  changes_requested: "Changes Requested",
  rejected: "Rejected",
  approved: "Approved",
  published: "Published",
};

export const EDITABLE_STATES: DocState[] = ["draft", "ai_generated", "changes_requested", "rejected"];

export type Transition = "submit" | "approve" | "reject" | "request_changes" | "publish" | "regenerate";

const RULES: Record<Transition, { from: DocState[]; to: DocState; role: Role | "author" }> = {
  regenerate: { from: EDITABLE_STATES, to: "ai_generated", role: "author" },
  submit: { from: ["ai_generated", "changes_requested", "rejected", "draft"], to: "under_review", role: "author" },
  approve: { from: ["under_review"], to: "approved", role: "admin" },
  reject: { from: ["under_review"], to: "rejected", role: "admin" },
  request_changes: { from: ["under_review"], to: "changes_requested", role: "admin" },
  publish: { from: ["approved"], to: "published", role: "admin" },
};

export function canTransition(t: Transition, state: DocState): boolean {
  return RULES[t].from.includes(state);
}

export function nextState(t: Transition, state: DocState): DocState {
  if (!canTransition(t, state)) {
    throw new Error(`Cannot ${t.replace("_", " ")} a document that is "${STATE_LABELS[state]}".`);
  }
  return RULES[t].to;
}

export function transitionRole(t: Transition) {
  return RULES[t].role;
}

export function isEditable(state: DocState) {
  return EDITABLE_STATES.includes(state);
}

/**
 * Estimated hours saved = template's manual effort − (AI generation time + review allowance).
 * Shown as an estimate everywhere in the UI.
 */
export function estimateHoursSaved(manualHours: number, generationSeconds: number, reviewHours = Number(process.env.REVIEW_EFFORT_HOURS || 1)) {
  const actual = generationSeconds / 3600 + reviewHours;
  return Math.max(0, Math.round((manualHours - actual) * 10) / 10);
}
