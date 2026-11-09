"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileDown, GitCompare, Send, CheckCircle2, XCircle, MessageSquare, Undo2, Globe, Sparkles, RefreshCw, Info, AlertTriangle, Check, Pencil,
  FlaskConical, Save, Loader2, CloudOff, Cloud, History, FileText, Eye, Workflow,
} from "lucide-react";
import { api, downloadBlob, fmtDateTime, useApi } from "@/lib/client/api";
import { renderMermaidSvg, svgToPng } from "@/lib/client/mermaid";
import { useToast } from "@/components/shared/toast";
import { Badge, Button, Card, ErrorState, Field, Modal, PageHeader, PageSkeleton, StateBadge, Textarea, cx } from "@/components/shared/ui";
import { RichEditor } from "@/components/editor/rich-editor";
import { MermaidDiagram } from "@/components/flowcharts/mermaid-diagram";
import { VersionCompare } from "@/components/documents/version-compare";
import { useAutosave } from "@/components/documents/use-autosave";
import { ApprovalTimeline } from "@/components/approvals/approval-timeline";
import type { DocContent, DocSection, DocumentApproval, GeneratedDocument, SessionUser } from "@/types";

interface Bundle {
  document: GeneratedDocument;
  editable: boolean;
  isAuthor: boolean;
  request: { id: string; number: string; documentType: string } | null;
  module: { moduleName: string; moduleOwner: string } | null;
  project: { name: string } | null;
  approvals: (DocumentApproval & { actorName: string })[];
  authorName: string;
}

type Tab = "editor" | "preview" | "diagram" | "review";

export function DocumentWorkspace({ id, area, user }: { id: string; area: "employee" | "admin"; user: Pick<SessionUser, "id" | "role"> }) {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<Bundle>(`/api/documents/${id}`);
  const [content, setContent] = useState<DocContent | null>(null);
  const [selected, setSelected] = useState("");
  const [rev, setRev] = useState(0);
  const [tab, setTab] = useState<Tab>("editor");
  const [busy, setBusy] = useState("");
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenText, setRegenText] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [dialog, setDialog] = useState<null | { kind: "submit" | "approved" | "rejected" | "changes_requested" | "comment" | "version" }>(null);
  const [comment, setComment] = useState("");

  const doc = data?.document;
  const editable = Boolean(data?.editable);
  const save = useAutosave(id, editable);

  useEffect(() => {
    if (!doc) return;
    setContent(doc.content);
    setSelected((s) => s || doc.content.sections[0]?.key || "");
  }, [doc]);

  const section = content?.sections.find((s) => s.key === selected);
  const issues = useMemo(() => (content?.sections || []).filter((s) => s.status !== "ok"), [content]);

  const onSectionChange = useCallback((html: string) => {
    setContent((c) => {
      if (!c) return c;
      const next = { sections: c.sections.map((s) => (s.key === selected ? { ...s, html } : s)) };
      save.queue(next);
      return next;
    });
  }, [selected, save]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  };
  const ensureSaved = async () => {
    if (!editable) return;
    const ok = await save.flush();
    if (!ok) throw new Error("Your latest edits could not be saved. Resolve the save error first.");
  };

  const replaceSection = (s: DocSection) => {
    setContent((c) => (c ? { sections: c.sections.some((x) => x.key === s.key) ? c.sections.map((x) => (x.key === s.key ? s : x)) : [...c.sections, s] } : c));
    setRev((r) => r + 1);
  };

  const regenerateSection = () => run("section", async () => {
    await ensureSaved();
    const r = await api<{ section: DocSection }>("/api/ai/regenerate-section", { body: { documentId: id, sectionKey: selected, instructions: regenText } });
    replaceSection(r.section);
    setRegenOpen(false);
    setRegenText("");
    toast.success(`“${r.section.title}” regenerated.`);
  });

  const generateTests = () => run("tests", async () => {
    await ensureSaved();
    const r = await api<{ section: DocSection; testCases: unknown[] }>("/api/ai/generate-test-cases", { body: { documentId: id } });
    replaceSection(r.section);
    setSelected(r.section.key);
    toast.success(`${r.testCases.length} test scenarios generated.`);
  });

  const regenerateAll = () => run("all", async () => {
    if (!data?.request) return;
    await ensureSaved();
    await api("/api/ai/generate-document", { body: { requestId: data.request.id } });
    toast.success("Document regenerated as a new version.");
    setSelected("");
    await reload();
    setRev((r) => r + 1);
  });

  const regenerateDiagram = (parseError?: string) => run("diagram", async () => {
    await ensureSaved();
    const r = await api<{ mermaid: string; notes: string }>("/api/ai/generate-flowchart", { body: { documentId: id, parseError } });
    setData((d) => (d ? { ...d, document: { ...d.document, mermaid: r.mermaid } } : d));
    toast.success(r.notes || "Diagram regenerated.");
  });

  const saveDiagram = async (code: string) => {
    try {
      await api(`/api/documents/${id}`, { method: "PATCH", body: { mermaid: code } });
      setData((d) => (d ? { ...d, document: { ...d.document, mermaid: code } } : d));
      toast.success("Diagram saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  const exportDoc = (format: "docx" | "pdf") => run(format, async () => {
    await ensureSaved();
    let diagram: { pngBase64: string; width: number; height: number } | undefined;
    if (doc?.mermaid) {
      try {
        const p = await svgToPng(await renderMermaidSvg(doc.mermaid));
        diagram = { pngBase64: p.base64, width: p.width, height: p.height };
      } catch {
        toast.warning("The workflow diagram has a syntax error and was left out of the export.");
      }
    }
    const blob = await api<Blob>(`/api/documents/${id}/export`, { body: { format, diagram } });
    downloadBlob(blob, `${(doc?.title || "handover").replace(/[^A-Za-z0-9 _-]/g, "").replace(/\s+/g, "_")}_v${doc?.currentVersion}.${format}`);
  });

  const confirmDialog = () => run("dialog", async () => {
    if (!dialog) return;
    if (dialog.kind === "version") {
      await ensureSaved();
      await api(`/api/documents/${id}`, { method: "PATCH", body: { saveVersion: true, changeSummary: comment || "Manual edits" } });
      toast.success("New version saved.");
    } else if (dialog.kind === "submit") {
      await ensureSaved();
      await api(`/api/documents/${id}/submit`, { body: { comments: comment } });
      toast.success("Submitted for approval.");
    } else {
      await api(`/api/documents/${id}/review`, { body: { action: dialog.kind, comments: comment } });
      toast.success({ approved: "Document approved.", rejected: "Document rejected.", changes_requested: "Changes requested.", comment: "Comment added." }[dialog.kind]);
    }
    setDialog(null);
    setComment("");
    await reload();
  });

  const publish = () => run("publish", async () => {
    await api(`/api/documents/${id}/publish`, { method: "POST" });
    toast.success("Document published.");
    await reload();
  });

  if (loading && !data) return <PageSkeleton />;
  if (error || !data || !doc || !content) return <ErrorState message={error || "Document not available."} onRetry={reload} />;

  const isAdmin = user.role === "admin";
  const canSubmit = data.isAuthor && ["ai_generated", "changes_requested", "rejected", "draft"].includes(doc.state);
  const canReview = isAdmin && doc.state === "under_review" && !data.isAuthor;
  const lastReview = [...data.approvals].reverse().find((a) => ["changes_requested", "rejected"].includes(a.action));
  const base = area === "admin" ? "/admin" : "/employee";

  return (
    <>
      <PageHeader
        title={doc.title}
        crumbs={[{ label: area === "admin" ? "Admin Portal" : "Employee Portal", href: `${base}/dashboard` }, { label: area === "admin" ? "Approvals" : "My Documents", href: area === "admin" ? "/admin/approvals" : "/employee/documents" }, { label: data.request?.number || "Document" }]}
        subtitle={`${data.project?.name || ""} · ${data.module?.moduleName || ""} · v${doc.currentVersion} · by ${data.authorName}`}
        actions={
          <>
            <StateBadge state={doc.state} />
            <Button size="sm" icon={GitCompare} onClick={() => setCompareOpen(true)}>Compare versions</Button>
            <Button size="sm" icon={FileDown} loading={busy === "docx"} disabled={busy !== ""} onClick={() => exportDoc("docx")}>DOCX</Button>
            <Button size="sm" icon={FileDown} loading={busy === "pdf"} disabled={busy !== ""} onClick={() => exportDoc("pdf")}>PDF</Button>
            {editable && <Button size="sm" icon={Save} disabled={busy !== ""} onClick={() => setDialog({ kind: "version" })}>Save version</Button>}
            {canSubmit && <Button size="sm" variant="primary" icon={Send} disabled={busy !== ""} onClick={() => setDialog({ kind: "submit" })}>{doc.state === "ai_generated" || doc.state === "draft" ? "Submit for approval" : "Resubmit"}</Button>}
            {canReview && (
              <>
                <Button size="sm" variant="success" icon={CheckCircle2} disabled={busy !== ""} onClick={() => setDialog({ kind: "approved" })}>Approve</Button>
                <Button size="sm" icon={Undo2} disabled={busy !== ""} onClick={() => setDialog({ kind: "changes_requested" })}>Request changes</Button>
                <Button size="sm" variant="danger" icon={XCircle} disabled={busy !== ""} onClick={() => setDialog({ kind: "rejected" })}>Reject</Button>
              </>
            )}
            {isAdmin && doc.state === "approved" && <Button size="sm" variant="primary" icon={Globe} loading={busy === "publish"} onClick={publish}>Publish</Button>}
            {isAdmin && <Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => setDialog({ kind: "comment" })}>Comment</Button>}
          </>
        }
      />

      {lastReview && ["changes_requested", "rejected"].includes(doc.state) && (
        <div role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
          <strong>{lastReview.action === "rejected" ? "Rejected" : "Changes requested"} by {lastReview.actorName}</strong> ({fmtDateTime(lastReview.createdAt)}): {lastReview.comments}
          {data.isAuthor && <span className="block pt-1 text-[12.5px]">Update the document (or its inputs) and click <strong>Resubmit</strong>.</span>}
        </div>
      )}

      {(issues.length > 0 || (doc.analysis && (doc.analysis.conflicts.length || doc.analysis.missingInformation.length))) && tab !== "review" && (
        <div className="mb-4 rounded-md border border-line bg-white p-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {issues.some((s) => s.status === "information_required") || doc.analysis?.missingInformation.length ? <Badge tone="amber"><Info className="h-3 w-3" />Information Required</Badge> : null}
            {issues.some((s) => s.status === "conflict") || doc.analysis?.conflicts.length ? <Badge tone="red"><AlertTriangle className="h-3 w-3" />Configuration Conflict Detected</Badge> : null}
            <span className="text-muted">{issues.length} section(s) need attention. Correct the inputs and regenerate, or edit the sections directly.</span>
            {editable && data.isAuthor && data.request && (
              <span className="ml-auto flex gap-2">
                <Link href={`/employee/new-request?id=${data.request.id}`}><Button size="sm" icon={Pencil}>Edit inputs</Button></Link>
                <Button size="sm" variant="ai" icon={RefreshCw} loading={busy === "all"} disabled={busy !== ""} onClick={regenerateAll}>Regenerate document</Button>
              </span>
            )}
          </div>
          {doc.analysis && (doc.analysis.missingInformation.length > 0 || doc.analysis.conflicts.length > 0) && (
            <details className="mt-2 text-[12.5px]">
              <summary className="cursor-pointer text-brand-600">Show AI analysis details</summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                {doc.analysis.missingInformation.map((m, i) => <li key={`m${i}`}><strong>Information Required — {m.field}:</strong> {m.reason}</li>)}
                {doc.analysis.conflicts.map((c, i) => <li key={`c${i}`} className="text-red-800"><strong>Configuration Conflict Detected:</strong> {c.description}</li>)}
                {doc.analysis.suggestions.map((s, i) => <li key={`s${i}`} className="text-muted">{s}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="mb-3 flex items-center gap-1 border-b border-line" role="tablist">
        {([["editor", "Editor", FileText], ["preview", "Preview", Eye], ["diagram", "Workflow diagram", Workflow], ["review", "Approval history", History]] as const).map(([k, label, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium", tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-ink")}>
            <I className="h-4 w-4" />{label}{k === "review" && data.approvals.length > 0 && <Badge>{data.approvals.length}</Badge>}
          </button>
        ))}
        <SaveIndicator editable={editable} state={save.state} lastSaved={save.lastSaved} error={save.error} onRetry={() => void save.flush()} />
      </div>

      {tab === "editor" && (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card padded={false} className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
            <ol className="py-1 text-[13px]">
              {["Cover Page", "Document Information", "Revision History"].map((t, i) => <li key={t} className="flex items-center gap-2 px-3 py-1.5 text-muted"><span className="w-5 text-right tabular-nums">{i + 1}.</span>{t}<span className="ml-auto text-[11px]">auto</span></li>)}
              {content.sections.map((s, i) => (
                <li key={s.key}>
                  <button onClick={() => setSelected(s.key)} className={cx("flex w-full items-center gap-2 px-3 py-1.5 text-left", selected === s.key ? "bg-brand-50 font-medium text-brand-700" : "hover:bg-surface")}>
                    <span className="w-5 text-right tabular-nums text-muted">{i + 4}.</span>
                    <span className="flex-1 truncate">{s.title}</span>
                    {s.status === "ok" ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Complete" /> : s.status === "conflict" ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-label="Conflict" /> : <Info className="h-3.5 w-3.5 text-amber-600" aria-label="Information required" />}
                  </button>
                </li>
              ))}
            </ol>
          </Card>
          {section && (
            <Card padded={false} title={<span className="flex items-center gap-2">{section.title}{section.status !== "ok" && <Badge tone={section.status === "conflict" ? "red" : "amber"}>{section.status === "conflict" ? "Configuration Conflict Detected" : "Information Required"}</Badge>}</span>}
              actions={editable && (
                <>
                  {section.key === "testing_scenarios" && <Button size="sm" variant="ai" icon={FlaskConical} loading={busy === "tests"} disabled={busy !== ""} onClick={generateTests}>Generate test cases</Button>}
                  <Button size="sm" variant="ai" icon={Sparkles} disabled={busy !== ""} onClick={() => setRegenOpen(true)}>Regenerate section</Button>
                </>
              )}>
              {!editable && <p className="border-b border-line bg-surface px-4 py-2 text-[12.5px] text-muted">Read-only: this document is {doc.state.replace("_", " ")}.</p>}
              <RichEditor key={`${section.key}-${rev}`} html={section.html} editable={editable} onChange={onSectionChange} />
            </Card>
          )}
        </div>
      )}

      {tab === "preview" && (
        <Card>
          <article className="mx-auto max-w-3xl">
            <div className="border-b border-line pb-6">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-ai-600">Handover Document</p>
              <h1 className="mt-1 text-2xl font-semibold text-navy-900">{doc.title}</h1>
              <p className="mt-1 text-[13px] text-muted">{data.project?.name} · {data.module?.moduleName} · Version {doc.currentVersion} · {doc.state.replace("_", " ")}</p>
            </div>
            <nav className="my-6 rounded-md bg-surface p-4 text-[13px]" aria-label="Table of contents">
              <p className="mb-2 font-semibold">Table of Contents</p>
              <ol className="columns-1 gap-6 md:columns-2">
                {["Cover Page", "Document Information", "Revision History", ...content.sections.map((s) => s.title)].map((t, i) => <li key={i}>{i + 1}. {t}</li>)}
              </ol>
            </nav>
            {content.sections.map((s, i) => (
              <section key={s.key} className="mb-6">
                <h2 className="mb-2 text-lg font-semibold text-navy-900">{i + 4}. {s.title}</h2>
                {s.key === "workflow_routing" && doc.mermaid && <div className="mb-3 rounded-md border border-line"><MermaidDiagram code={doc.mermaid} fileName="workflow" /></div>}
                <div className="doc-prose" dangerouslySetInnerHTML={{ __html: s.html }} />
              </section>
            ))}
          </article>
        </Card>
      )}

      {tab === "diagram" && (
        <Card padded={false} title="Process flow diagram" actions={<Badge tone="purple">Mermaid</Badge>}>
          <MermaidDiagram code={doc.mermaid} editable={editable} regenerating={busy === "diagram"} onRegenerate={() => regenerateDiagram()} onAutoFix={(err) => regenerateDiagram(err)} onSave={saveDiagram} fileName={doc.title.replace(/\s+/g, "_")} />
        </Card>
      )}

      {tab === "review" && (
        <Card title="Approval history">
          <ApprovalTimeline items={data.approvals} />
        </Card>
      )}

      <Modal open={regenOpen} onClose={() => setRegenOpen(false)} title={`Regenerate “${section?.title || ""}”`}
        footer={<><Button onClick={() => setRegenOpen(false)}>Cancel</Button><Button variant="ai" icon={Sparkles} loading={busy === "section"} onClick={regenerateSection}>Regenerate</Button></>}>
        <Field label="Instructions (optional)" hint="e.g. “Simplify for a new employee”, “Add a table of groups”, “Shorter”. The AI only uses the project’s configuration.">
          <Textarea value={regenText} onChange={(e) => setRegenText(e.target.value)} rows={4} />
        </Field>
        <p className="mt-2 text-[12px] text-muted">This replaces the current section content. Use “Compare versions” after saving a version to review changes.</p>
      </Modal>

      <Modal open={Boolean(dialog)} onClose={() => setDialog(null)}
        title={{ submit: "Submit for approval", approved: "Approve document", rejected: "Reject document", changes_requested: "Request changes", comment: "Add review comment", version: "Save a new version" }[dialog?.kind || "submit"]}
        footer={<><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant={dialog?.kind === "rejected" ? "danger" : dialog?.kind === "approved" ? "success" : "primary"} loading={busy === "dialog"} onClick={confirmDialog}>Confirm</Button></>}>
        {dialog?.kind === "submit" && issues.length > 0 && <p className="mb-3 rounded-md bg-amber-50 p-2 text-[12.5px] text-amber-900">{issues.length} section(s) still show Information Required or Configuration Conflict Detected. You can submit anyway, but the reviewer will see them.</p>}
        <Field label={dialog?.kind === "version" ? "Change summary" : dialog?.kind === "approved" || dialog?.kind === "submit" ? "Comments (optional)" : "Comments (required)"}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
        </Field>
      </Modal>

      <VersionCompare documentId={id} open={compareOpen} onClose={() => setCompareOpen(false)} />
      {busy === "all" && (
        <Modal open onClose={() => {}} title="Regenerating document">
          <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Groq is rewriting all sections and the diagram. This can take up to two minutes.</p>
        </Modal>
      )}
    </>
  );
}

function SaveIndicator({ editable, state, lastSaved, error, onRetry }: { editable: boolean; state: string; lastSaved: Date | null; error: string; onRetry: () => void }) {
  if (!editable) return <span className="ml-auto text-[12px] text-muted">Read-only</span>;
  return (
    <span className="ml-auto flex items-center gap-1.5 text-[12px]" aria-live="polite">
      {state === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted" /><span className="text-muted">Saving…</span></>}
      {state === "dirty" && <span className="text-amber-700">Unsaved changes</span>}
      {state === "saved" && <><Cloud className="h-3.5 w-3.5 text-emerald-600" /><span className="text-muted">{lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : "All changes saved"}</span></>}
      {state === "error" && <><CloudOff className="h-3.5 w-3.5 text-red-600" /><span className="text-red-700" title={error}>Not saved — {error.slice(0, 60)}</span><button className="font-medium text-brand-600" onClick={onRetry}>Retry</button></>}
    </span>
  );
}
