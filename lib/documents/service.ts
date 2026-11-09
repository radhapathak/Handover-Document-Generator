import { HttpError } from "@/lib/api/errors";
import { assertCanAccessDocument, assertCanAccessRequest } from "@/lib/auth/guard";
import { audit, logError } from "@/lib/audit";
import { analyzeConfiguration, buildContext, defaultSectionKeys, generateFlowchart, generateSections, type GenerationContext } from "@/lib/ai/pipeline";
import { canTransition, estimateHoursSaved, isEditable, nextState, STATE_LABELS, type Transition } from "@/lib/documents/lifecycle";
import { sanitizeSectionHtml, deriveStatus } from "@/lib/documents/html";
import { sanitizeMermaid } from "@/lib/mermaid/sanitize";
import { documentApprovals } from "@/lib/servicenow/approvals";
import { documentRequests, documentVersions, generatedDocuments } from "@/lib/servicenow/documents";
import { moduleConfigurations, projects } from "@/lib/servicenow/projects";
import { templates } from "@/lib/servicenow/templates";
import type { ApprovalAction, DocContent, GeneratedDocument, SessionUser } from "@/types";

export async function loadGenerationContext(user: SessionUser, requestId: string): Promise<GenerationContext> {
  const request = await documentRequests.getOrThrow(requestId);
  assertCanAccessRequest(user, request);
  const [module, project, template] = await Promise.all([
    moduleConfigurations.getOrThrow(request.moduleConfigId),
    request.projectId ? projects.get(request.projectId) : Promise.resolve(null),
    request.templateId ? templates.get(request.templateId) : Promise.resolve(null),
  ]);
  return { request, module, project, template };
}

export async function loadDocument(user: SessionUser, id: string): Promise<GeneratedDocument> {
  const doc = await generatedDocuments.get(id);
  if (!doc) throw new HttpError(404, "Document not found.");
  assertCanAccessDocument(user, doc);
  return doc;
}

export async function findDocumentForRequest(requestId: string) {
  const { items } = await generatedDocuments.list({ where: { requestId }, limit: 1 });
  return items[0] || null;
}

/** Full AI generation: analysis → sections (batched) → flowchart. Stores the document and a new version. */
export async function generateDocument(user: SessionUser, requestId: string): Promise<GeneratedDocument> {
  const g = await loadGenerationContext(user, requestId);
  const existing = await findDocumentForRequest(requestId);
  if (existing) {
    assertCanAccessDocument(user, existing);
    if (!isEditable(existing.state)) {
      throw new HttpError(409, `This document is "${STATE_LABELS[existing.state]}" and cannot be regenerated.`);
    }
  }

  const started = Date.now();
  const ai = { userId: user.id, requestId, documentId: existing?.id, operation: "generate-document" };
  const context = buildContext(g);
  const analysis = await analyzeConfiguration(ai, context);
  const sections = await generateSections(ai, context, defaultSectionKeys(g.template), analysis, g.template?.instructions || "");

  let mermaid = "";
  try {
    mermaid = (await generateFlowchart(ai, context)).mermaid;
  } catch (e) {
    // The document is still useful without a diagram; tell the user instead of failing everything.
    logError("flowchart", e, { requestId });
    analysis.suggestions = [`Workflow diagram could not be generated: ${e instanceof Error ? e.message : e}. Use "Regenerate diagram".`, ...analysis.suggestions];
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  const content: DocContent = { sections };
  const title = `${g.module.moduleName} — ${g.request.documentType}`;
  const version = (existing?.currentVersion || 0) + 1;

  const fields: Partial<GeneratedDocument> = {
    requestId,
    projectId: g.request.projectId,
    authorId: existing?.authorId || g.request.requestedBy,
    title: existing?.title || title,
    state: "ai_generated",
    currentVersion: version,
    content,
    mermaid,
    analysis,
    generationSeconds: seconds,
    estimatedHoursSaved: estimateHoursSaved(g.template?.manualEffortHours ?? 16, seconds),
  };
  const doc = existing ? await generatedDocuments.update(existing.id, fields) : await generatedDocuments.create(fields);
  await documentVersions.create({ documentId: doc.id, versionNumber: version, content, mermaid, changeSummary: existing ? "AI regeneration" : "Initial AI generation", createdBy: user.id });
  await documentRequests.update(requestId, { state: "generated" });
  audit("document.generated", { user: user.id, documentId: doc.id, requestId, seconds, version });
  return doc;
}

export async function saveDocument(
  user: SessionUser,
  id: string,
  patch: { content?: DocContent; mermaid?: string; title?: string; saveVersion?: boolean; changeSummary?: string }
) {
  const doc = await loadDocument(user, id);
  if (!isEditable(doc.state)) throw new HttpError(409, `A document that is "${STATE_LABELS[doc.state]}" cannot be edited.`);
  if (user.role !== "admin" && doc.authorId !== user.id) throw new HttpError(403, "Only the author can edit this document.");

  const update: Partial<GeneratedDocument> = {};
  if (patch.title) update.title = patch.title;
  if (patch.content) {
    update.content = {
      sections: patch.content.sections.map((s) => {
        const html = sanitizeSectionHtml(s.html);
        return { ...s, html, status: deriveStatus(html) };
      }),
    };
  }
  if (patch.mermaid !== undefined) {
    if (patch.mermaid === "") update.mermaid = "";
    else {
      const check = sanitizeMermaid(patch.mermaid);
      if (!check.ok) throw new HttpError(400, `Diagram not saved: ${check.error}`);
      update.mermaid = check.code;
    }
  }
  if (patch.saveVersion) update.currentVersion = doc.currentVersion + 1;
  const saved = await generatedDocuments.update(id, update);
  if (patch.saveVersion) {
    await documentVersions.create({
      documentId: id,
      versionNumber: saved.currentVersion,
      content: saved.content,
      mermaid: saved.mermaid,
      changeSummary: patch.changeSummary || "Manual edits",
      createdBy: user.id,
    });
  }
  return saved;
}

async function recordApproval(docId: string, version: number, actorId: string, action: ApprovalAction, comments: string) {
  return documentApprovals.create({ documentId: docId, versionNumber: version, actorId, action, comments });
}

export async function submitDocument(user: SessionUser, id: string, comments = "") {
  const doc = await loadDocument(user, id);
  if (doc.authorId !== user.id) throw new HttpError(403, "Only the author can submit this document.");
  if (!canTransition("submit", doc.state)) throw new HttpError(409, `A document that is "${STATE_LABELS[doc.state]}" cannot be submitted.`);
  const version = doc.currentVersion + 1;
  const saved = await generatedDocuments.update(id, { state: nextState("submit", doc.state), submittedAt: new Date().toISOString(), currentVersion: version });
  await documentVersions.create({ documentId: id, versionNumber: version, content: doc.content, mermaid: doc.mermaid, changeSummary: "Submitted for review", createdBy: user.id });
  await recordApproval(id, version, user.id, "submitted", comments);
  audit("document.submitted", { user: user.id, documentId: id, version });
  return saved;
}

export async function reviewDocument(admin: SessionUser, id: string, action: "approved" | "rejected" | "changes_requested" | "comment", comments: string) {
  const doc = await loadDocument(admin, id);
  if (action === "comment") {
    await recordApproval(id, doc.currentVersion, admin.id, "comment", comments);
    audit("document.comment", { user: admin.id, documentId: id });
    return doc;
  }
  if (doc.authorId === admin.id) throw new HttpError(403, "You cannot review your own document.");
  const t: Transition = action === "approved" ? "approve" : action === "rejected" ? "reject" : "request_changes";
  if (!canTransition(t, doc.state)) throw new HttpError(409, `Only documents under review can be ${action.replace("_", " ")}.`);
  const saved = await generatedDocuments.update(id, {
    state: nextState(t, doc.state),
    ...(action === "approved" ? { approvedAt: new Date().toISOString() } : {}),
  });
  await recordApproval(id, doc.currentVersion, admin.id, action, comments);
  audit(`document.${action}`, { user: admin.id, documentId: id });
  return saved;
}

export async function publishDocument(admin: SessionUser, id: string) {
  const doc = await loadDocument(admin, id);
  if (!canTransition("publish", doc.state)) throw new HttpError(409, "Only approved documents can be published.");
  const saved = await generatedDocuments.update(id, { state: "published", publishedAt: new Date().toISOString() });
  await recordApproval(id, doc.currentVersion, admin.id, "published", "");
  await documentRequests.update(doc.requestId, { state: "closed" }).catch((e) => logError("request-close", e));
  audit("document.published", { user: admin.id, documentId: id });
  return saved;
}
