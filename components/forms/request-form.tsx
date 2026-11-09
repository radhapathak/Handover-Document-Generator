"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Sparkles, Upload, SearchCheck, ChevronDown, AlertTriangle, Info, FileUp, CheckCircle2, Paperclip } from "lucide-react";
import { api, fmtDateTime, useApi } from "@/lib/client/api";
import { useToast } from "@/components/shared/toast";
import { Badge, Button, Card, ErrorState, Field, Input, Modal, PageSkeleton, Select, Textarea, cx } from "@/components/shared/ui";
import type { AnalysisResult, ModuleConfigInput, Project, DocumentTemplate } from "@/types";

type Cfg = ModuleConfigInput;
interface Head {
  projectMode: "existing" | "new";
  projectId: string;
  newProject: { name: string; projectCode: string; applicationName: string; department: string; description: string };
  moduleName: string; moduleOwner: string; businessDepartment: string; documentType: string; description: string; templateId: string;
}

const DOC_TYPES = ["Technical Handover", "KT Summary", "Module Configuration Guide", "Business Rule Documentation", "Workflow Description", "Support Runbook"];

const emptyHead: Head = {
  projectMode: "existing", projectId: "", newProject: { name: "", projectCode: "", applicationName: "", department: "", description: "" },
  moduleName: "", moduleOwner: "", businessDepartment: "", documentType: "Technical Handover", description: "", templateId: "",
};

type TextKey = Exclude<{ [K in keyof Cfg]-?: NonNullable<Cfg[K]> extends string ? K : never }[keyof Cfg], undefined>;
const T = (key: TextKey, label: string, hint?: string, rows = 3) => ({ key, label, hint, rows });

const SECTION_B = [T("businessPurpose", "Business Purpose", "Why the module exists and the business problem it solves."), T("moduleFunctionality", "Module Functionality", "What users can do with it, end to end."), T("configurationDetails", "Configuration Details", "Key configuration items, properties, choice lists…"), T("conditions", "Conditions", "General conditions that apply across rules."), T("routingLogic", "Routing Logic", "How records are routed, in evaluation order."), T("approvalProcess", "Approval Process", "Overall approval approach."), T("rolesAndPermissions", "Roles and Permissions")];
const SECTION_C = [T("tableNames", "Table Names", "e.g. incident, x_acme_request", 2), T("fieldNames", "Field Names", undefined, 2), T("scriptDetails", "Script Details", "Paste or describe scripts. Avoid secrets.", 4), T("businessRuleNames", "Business Rule Names", undefined, 2), T("clientScripts", "Client Scripts"), T("serverScripts", "Server Scripts"), T("scheduledJobs", "Scheduled Jobs", undefined, 2), T("integrations", "Integrations"), T("apiDetails", "API Details"), T("notifications", "Notifications"), T("dependencies", "Dependencies", undefined, 2)];
const SECTION_D = [T("workflowName", "Workflow Name", undefined, 1), T("triggerConditions", "Trigger Conditions"), T("startCondition", "Start Condition", undefined, 2), T("decisionConditions", "Decision Conditions"), T("assignmentConditions", "Assignment Conditions"), T("escalationRules", "Escalation Rules"), T("completionConditions", "Completion Conditions", undefined, 2), T("exceptionHandling", "Exception Handling")];
const SECTION_E = [T("knownIssues", "Known Issues"), T("limitations", "Limitations"), T("troubleshootingDetails", "Troubleshooting Details"), T("testingScenarios", "Testing Scenarios", "Existing test cases, if any."), T("additionalNotes", "Additional Notes")];

interface Loaded {
  request: { id: string; number: string; projectId: string; templateId: string; documentType: string; referenceChars: number };
  module: { moduleName: string; moduleOwner: string; businessDepartment: string; documentType: string; description: string; config: Cfg };
  document: { id: string; state: string } | null;
  attachments: { id: string; fileName: string; sizeBytes: number; createdAt: string }[];
}

export function RequestForm({ requestId }: { requestId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const projectsApi = useApi<{ items: Project[] }>("/api/projects");
  const templatesApi = useApi<{ items: DocumentTemplate[] }>("/api/templates");
  const existing = useApi<Loaded>(requestId ? `/api/requests/${requestId}` : null);

  const [head, setHead] = useState<Head>(emptyHead);
  const [cfg, setCfg] = useState<Cfg>({ categories: [{ name: "", subcategories: "" }], businessRules: [{ name: "", condition: "", description: "" }], assignmentGroups: [{ name: "", condition: "" }], approvalStages: [] });
  const [open, setOpen] = useState<Record<string, boolean>>({ A: true, B: true, C: false, D: false, E: false });
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState<"" | "analyze" | "generate" | "upload">("");
  const [elapsed, setElapsed] = useState(0);
  const [errors, setErrors] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doc = existing.data?.document;
  const locked = Boolean(doc && !["draft", "ai_generated", "changes_requested", "rejected"].includes(doc.state));

  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    setHead({
      ...emptyHead,
      projectId: d.request.projectId,
      moduleName: d.module.moduleName, moduleOwner: d.module.moduleOwner, businessDepartment: d.module.businessDepartment,
      documentType: d.module.documentType || d.request.documentType, description: d.module.description, templateId: d.request.templateId,
    });
    setCfg({ ...d.module.config });
    setOpen({ A: true, B: true, C: true, D: true, E: true });
  }, [existing.data]);

  useEffect(() => {
    if (!head.templateId && templatesApi.data?.items.length) setHead((h) => ({ ...h, templateId: templatesApi.data!.items[0].id }));
  }, [templatesApi.data, head.templateId]);

  useEffect(() => {
    if (busy !== "generate" && busy !== "analyze") return;
    const s = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.round((Date.now() - s) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const setH = <K extends keyof Head>(k: K, v: Head[K]) => { setHead((h) => ({ ...h, [k]: v })); setDirty(true); };
  const setC = <K extends keyof Cfg>(k: K, v: Cfg[K]) => { setCfg((c) => ({ ...c, [k]: v })); setDirty(true); };

  const payload = useMemo(() => ({
    project: head.projectMode === "existing" ? { existingId: head.projectId } : { create: { ...head.newProject, status: "active" } },
    moduleName: head.moduleName, moduleOwner: head.moduleOwner, businessDepartment: head.businessDepartment,
    documentType: head.documentType, description: head.description, templateId: head.templateId || undefined, config: cfg,
  }), [head, cfg]);

  function validate(): string {
    if (head.projectMode === "existing" && !head.projectId) return "Select a project, or add a new one.";
    if (head.projectMode === "new" && head.newProject.name.trim().length < 2) return "Enter a name for the new project.";
    if (head.moduleName.trim().length < 2) return "Module Name is required.";
    return "";
  }

  async function save(): Promise<string | null> {
    const v = validate();
    setErrors(v);
    if (v) { toast.error(v); return null; }
    setSaving(true);
    try {
      if (requestId) {
        await api(`/api/requests/${requestId}`, { method: "PATCH", body: payload });
        toast.success("Draft saved to ServiceNow.");
        setDirty(false);
        existing.reload();
        return requestId;
      }
      const r = await api<{ item: { id: string } }>("/api/requests", { body: payload });
      setDirty(false);
      toast.success("Request created. You can now upload references, analyse and generate.");
      router.replace(`/employee/new-request?id=${r.item.id}`);
      return r.item.id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function analyze() {
    const id = dirty || !requestId ? await save() : requestId;
    if (!id) return;
    setBusy("analyze");
    try {
      const r = await api<{ analysis: AnalysisResult }>("/api/ai/analyze", { body: { requestId: id } });
      setAnalysis(r.analysis);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function generate() {
    const id = dirty || !requestId ? await save() : requestId;
    if (!id) return;
    setBusy("generate");
    try {
      const r = await api<{ document: { id: string; generationSeconds: number } }>("/api/ai/generate-document", { body: { requestId: id } });
      toast.success(`Document generated in ${r.document.generationSeconds} seconds.`);
      router.push(`/employee/documents/${r.document.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setBusy("");
    }
  }

  async function upload(f: File) {
    if (!requestId) return;
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("file", f);
      const r = await api<{ extractedChars: number; truncated: boolean }>(`/api/requests/${requestId}/attachments`, { form });
      toast.success(`Uploaded ${f.name} (${r.extractedChars.toLocaleString()} characters of text extracted${r.truncated ? ", reference text limit reached" : ""}).`);
      existing.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if ((requestId && existing.loading && !existing.data) || projectsApi.loading) return <PageSkeleton />;
  if (existing.error) return <ErrorState message={existing.error} onRetry={existing.reload} />;

  const textFields = (list: ReturnType<typeof T>[]) => (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((f) => (
        <Field key={f.key} label={f.label} hint={f.hint} htmlFor={f.key}>
          {f.rows === 1 ? (
            <Input id={f.key} value={(cfg[f.key] as string) || ""} onChange={(e) => setC(f.key, e.target.value)} disabled={locked} />
          ) : (
            <Textarea id={f.key} rows={f.rows} value={(cfg[f.key] as string) || ""} onChange={(e) => setC(f.key, e.target.value)} disabled={locked} placeholder="Plain English is fine" />
          )}
        </Field>
      ))}
    </div>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {locked && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">This request’s document is under review or approved, so its inputs are read-only.</div>}
        {errors && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">{errors}</div>}

        <Section open={open} setOpen={setOpen} id="A" title="Project Information" desc="Which project and module this handover covers.">
          <div className="mb-4 flex gap-2" role="radiogroup" aria-label="Project">
            {(["existing", "new"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={head.projectMode === m} disabled={locked} onClick={() => setH("projectMode", m)} className={cx("rounded-md border px-3 py-1.5 text-[13px]", head.projectMode === m ? "border-brand-600 bg-brand-50 font-medium text-brand-700" : "border-line bg-white")}>
                {m === "existing" ? "Select existing project" : "Add new project"}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {head.projectMode === "existing" ? (
              <Field label="Project" required htmlFor="project">
                <Select id="project" value={head.projectId} onChange={(e) => setH("projectId", e.target.value)} disabled={locked}>
                  <option value="">Select a project…</option>
                  {projectsApi.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}{p.projectCode ? ` (${p.projectCode})` : ""}</option>)}
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Project Name" required htmlFor="pname"><Input id="pname" value={head.newProject.name} onChange={(e) => setH("newProject", { ...head.newProject, name: e.target.value })} /></Field>
                <Field label="Project ID" htmlFor="pcode"><Input id="pcode" value={head.newProject.projectCode} onChange={(e) => setH("newProject", { ...head.newProject, projectCode: e.target.value })} placeholder="e.g. PRJ-1005" /></Field>
                <Field label="Application Name" htmlFor="papp"><Input id="papp" value={head.newProject.applicationName} onChange={(e) => setH("newProject", { ...head.newProject, applicationName: e.target.value })} /></Field>
                <Field label="Project Department" htmlFor="pdept"><Input id="pdept" value={head.newProject.department} onChange={(e) => setH("newProject", { ...head.newProject, department: e.target.value })} /></Field>
              </>
            )}
            <Field label="Module Name" required htmlFor="module"><Input id="module" value={head.moduleName} onChange={(e) => setH("moduleName", e.target.value)} disabled={locked} placeholder="e.g. Incident Management" /></Field>
            <Field label="Module Owner" htmlFor="owner"><Input id="owner" value={head.moduleOwner} onChange={(e) => setH("moduleOwner", e.target.value)} disabled={locked} /></Field>
            <Field label="Business Department" htmlFor="dept"><Input id="dept" value={head.businessDepartment} onChange={(e) => setH("businessDepartment", e.target.value)} disabled={locked} /></Field>
            <Field label="Document Type" required htmlFor="dtype">
              <Select id="dtype" value={head.documentType} onChange={(e) => setH("documentType", e.target.value)} disabled={locked}>
                {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Template" htmlFor="tpl" hint="Controls which sections are generated.">
              <Select id="tpl" value={head.templateId} onChange={(e) => setH("templateId", e.target.value)} disabled={locked}>
                {templatesApi.data?.items.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.sections.length} sections)</option>)}
              </Select>
            </Field>
            <div className="md:col-span-2"><Field label="Description" htmlFor="desc"><Textarea id="desc" value={head.description} onChange={(e) => setH("description", e.target.value)} disabled={locked} /></Field></div>
          </div>
        </Section>

        <Section open={open} setOpen={setOpen} id="B" title="Module Configuration" desc="Business purpose, categories, business rules, routing and approvals.">
          {textFields(SECTION_B.slice(0, 2))}
          <ListEditor
            title="Categories" disabled={locked}
            items={cfg.categories || []}
            fields={[{ key: "name", label: "Category", placeholder: "e.g. Hardware" }, { key: "subcategories", label: "Subcategories", placeholder: "Comma-separated, e.g. Laptop, Printer" }]}
            onChange={(v) => setC("categories", v)}
          />
          <ListEditor
            title="Business Rules" disabled={locked}
            items={cfg.businessRules || []}
            fields={[{ key: "name", label: "Rule name" }, { key: "condition", label: "When / condition" }, { key: "description", label: "What it does" }]}
            onChange={(v) => setC("businessRules", v)}
          />
          <ListEditor
            title="Assignment Groups" disabled={locked}
            items={cfg.assignmentGroups || []}
            fields={[{ key: "name", label: "Group name" }, { key: "condition", label: "Receives work when…" }]}
            onChange={(v) => setC("assignmentGroups", v)}
          />
          <ListEditor
            title="Approval Stages" disabled={locked}
            items={cfg.approvalStages || []}
            fields={[{ key: "name", label: "Stage" }, { key: "approver", label: "Approver" }, { key: "condition", label: "Condition" }]}
            onChange={(v) => setC("approvalStages", v)}
          />
          <div className="mt-4">{textFields(SECTION_B.slice(2))}</div>
        </Section>

        <Section open={open} setOpen={setOpen} id="C" title="Technical Information" desc="Tables, fields, scripts, integrations and dependencies.">{textFields(SECTION_C)}</Section>
        <Section open={open} setOpen={setOpen} id="D" title="Workflow Information" desc="Triggers, decisions, approvals, escalations and exceptions.">{textFields(SECTION_D)}</Section>
        <Section open={open} setOpen={setOpen} id="E" title="Additional Information" desc="Known issues, troubleshooting and test notes.">{textFields(SECTION_E)}</Section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card title={requestId ? `Request ${existing.data?.request.number || ""}` : "New request"}>
          <p className="text-[12.5px] text-muted">Only Module Name and a project are required. Add as much detail as you have — missing details are flagged as <strong>Information Required</strong> in the document.</p>
          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={save} loading={saving} disabled={locked || busy !== ""} icon={Save}>{requestId ? "Save draft" : "Save draft request"}</Button>
            <Button variant="secondary" onClick={analyze} loading={busy === "analyze"} disabled={locked || busy !== "" || saving} icon={SearchCheck}>Analyse configuration</Button>
            <Button variant="ai" onClick={generate} loading={busy === "generate"} disabled={locked || busy !== "" || saving} icon={Sparkles}>
              {doc ? "Regenerate documentation" : "Generate documentation"}
            </Button>
            {doc && <Button variant="ghost" onClick={() => router.push(`/employee/documents/${doc.id}`)}>Open generated document</Button>}
          </div>
          {dirty && <p className="mt-2 text-[12px] text-amber-700">Unsaved changes</p>}
        </Card>

        <Card title="Reference attachments" actions={<Paperclip className="h-4 w-4 text-muted" />}>
          {!requestId ? <p className="text-[12.5px] text-muted">Save the request first, then upload reference documents (.docx, .pdf, .txt, .md, .csv, .json — up to 5 MB). Their text is used as AI context.</p> : (
            <>
              <input ref={fileRef} type="file" className="hidden" accept=".docx,.pdf,.txt,.md,.csv,.json" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <Button size="sm" icon={Upload} loading={busy === "upload"} disabled={locked || busy !== ""} onClick={() => fileRef.current?.click()}>Upload reference document</Button>
              <ul className="mt-3 space-y-1.5">
                {existing.data?.attachments.length ? existing.data.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-[12.5px]"><FileUp className="h-3.5 w-3.5 text-muted" /><span className="flex-1 truncate">{a.fileName}</span><span className="text-muted">{Math.ceil(a.sizeBytes / 1024)} KB</span></li>
                )) : <li className="text-[12.5px] text-muted">No attachments yet.</li>}
              </ul>
              {existing.data?.request.referenceChars ? <p className="mt-2 text-[12px] text-muted">{existing.data.request.referenceChars.toLocaleString()} characters of reference text available to the AI.</p> : null}
            </>
          )}
        </Card>

        {analysis && (
          <Card title="Configuration analysis" actions={<Badge tone="purple">Groq</Badge>}>
            <p className="text-[13px]">{analysis.summary}</p>
            {analysis.missingInformation.length > 0 && (
              <div className="mt-3">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-800"><Info className="h-4 w-4" />Information Required ({analysis.missingInformation.length})</p>
                <ul className="mt-1 space-y-1 text-[12.5px]">{analysis.missingInformation.map((m, i) => <li key={i}><strong>{m.field}:</strong> {m.reason}</li>)}</ul>
              </div>
            )}
            {analysis.conflicts.length > 0 && (
              <div className="mt-3">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-red-700"><AlertTriangle className="h-4 w-4" />Configuration Conflict Detected ({analysis.conflicts.length})</p>
                <ul className="mt-1 space-y-1 text-[12.5px]">{analysis.conflicts.map((c, i) => <li key={i}>{c.description}{c.items.length ? ` (${c.items.join(", ")})` : ""}</li>)}</ul>
              </div>
            )}
            {analysis.missingInformation.length === 0 && analysis.conflicts.length === 0 && <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-emerald-700"><CheckCircle2 className="h-4 w-4" />No gaps or conflicts found.</p>}
            {analysis.suggestions.length > 0 && <ul className="mt-3 list-disc space-y-0.5 pl-4 text-[12.5px] text-muted">{analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>}
          </Card>
        )}
      </aside>

      <Modal open={busy === "generate"} onClose={() => {}} title="Generating documentation">
        <div className="flex flex-col items-center py-4 text-center">
          <Sparkles className="h-8 w-8 animate-pulse text-ai-600" />
          <p className="mt-3 text-[14px] font-medium">Groq is analysing the configuration, writing each section and drawing the workflow diagram.</p>
          <p className="mt-1 text-[13px] text-muted">This usually takes 30–120 seconds. Please keep this page open.</p>
          <p className="mt-3 font-mono text-[13px] text-muted">Elapsed: {elapsed}s</p>
          {existing.data?.request && <p className="mt-1 text-[12px] text-muted">Last saved {fmtDateTime(new Date().toISOString())}</p>}
        </div>
      </Modal>
    </div>
  );
}

function Section({ id, title, desc, children, open, setOpen }: { id: string; title: string; desc: string; children: React.ReactNode; open: Record<string, boolean>; setOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>> }) {
  return (
    <section className="rounded-lg border border-line bg-white" id={`section-${id}`}>
      <button type="button" onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open[id]}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-navy-900 text-[12px] font-semibold text-white">{id}</span>
        <span className="flex-1"><span className="block text-[14px] font-semibold text-navy-900">{title}</span><span className="block text-[12px] text-muted">{desc}</span></span>
        <ChevronDown className={cx("h-4 w-4 text-muted transition-transform", open[id] && "rotate-180")} />
      </button>
      {open[id] && <div className="border-t border-line p-4">{children}</div>}
    </section>
  );
}

function ListEditor({ title, items, fields, onChange, disabled }: {
  title: string;
  items: object[];
  fields: { key: string; label: string; placeholder?: string }[];
  onChange: (v: never[]) => void;
  disabled?: boolean;
}) {
  const rows = items as Record<string, string>[];
  const emit = (v: Record<string, string>[]) => onChange(v as never[]);
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, ""]));
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 flex w-full items-center justify-between text-[13px] font-semibold text-ink">
        <span>{title} <span className="font-normal text-muted">({rows.filter((r) => r.name?.trim()).length})</span></span>
      </legend>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-line bg-surface/50 p-2 md:flex-row">
            {fields.map((f) => (
              <Input key={f.key} aria-label={`${title} ${i + 1} ${f.label}`} placeholder={f.placeholder || f.label} value={r[f.key] || ""} disabled={disabled}
                onChange={(e) => emit(rows.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} />
            ))}
            <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${title} ${i + 1}`} disabled={disabled} onClick={() => emit(rows.filter((_, j) => j !== i))} icon={Trash2} />
          </div>
        ))}
      </div>
      <Button type="button" size="sm" variant="ghost" className="mt-1 text-brand-600" disabled={disabled} icon={Plus} onClick={() => emit([...rows, blank()])}>Add {title.replace(/s$/, "").toLowerCase()}</Button>
    </fieldset>
  );
}
