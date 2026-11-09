"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { useToast } from "@/components/shared/toast";
import { Badge, Button, Card, ErrorState, Field, Input, Modal, PageHeader, Skeleton, Textarea } from "@/components/shared/ui";
import { DataTable, type Column } from "@/components/shared/data-table";
import type { DocumentTemplate } from "@/types";

type T = Omit<DocumentTemplate, "id" | "createdAt"> & { id?: string };

export default function TemplatesPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ items: DocumentTemplate[]; sections: { key: string; title: string }[] }>("/api/templates");
  const [edit, setEdit] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const all = data?.sections || [];

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      const { id, ...body } = edit;
      if (id) await api(`/api/templates/${id}`, { method: "PATCH", body });
      else await api("/api/templates", { body });
      toast.success("Template saved.");
      setEdit(null);
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  }

  const cols: Column<DocumentTemplate>[] = [
    { key: "name", header: "Template", render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-[12px] text-muted">{r.description}</p></div>, sortValue: (r) => r.name },
    { key: "type", header: "Document type", render: (r) => <Badge>{r.documentType}</Badge> },
    { key: "sections", header: "Sections", render: (r) => `${r.sections.length} of ${all.length}` },
    { key: "hours", header: "Manual effort", render: (r) => `${r.manualEffortHours} h` },
    { key: "active", header: "Status", render: (r) => <Badge tone={r.active ? "green" : "gray"}>{r.active ? "Active" : "Inactive"}</Badge> },
    { key: "act", header: "", render: (r) => <Button size="sm" variant="ghost" onClick={() => setEdit({ ...r })}>Edit</Button> },
  ];

  return (
    <>
      <PageHeader title="Document Templates" subtitle="Templates choose which sections the AI writes, add writing instructions, and set the manual-effort baseline used for hours-saved estimates." crumbs={[{ label: "Admin Portal", href: "/admin/dashboard" }, { label: "Templates" }]}
        actions={<Button variant="primary" icon={Plus} onClick={() => setEdit({ name: "", documentType: "Technical Handover", description: "", sections: all.map((s) => s.key), instructions: "", manualEffortHours: 16, active: true })}>New template</Button>} />
      <Card padded={false}>
        {loading && !data ? <div className="space-y-2 p-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : <DataTable rows={data?.items || []} columns={cols} />}
      </Card>
      <Modal wide open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? "Edit template" : "New template"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save} disabled={!edit?.sections.length}>Save</Button></>}>
        {edit && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Document type" required><Input value={edit.documentType} onChange={(e) => setEdit({ ...edit, documentType: e.target.value })} /></Field>
            <Field label="Description"><Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Manual effort baseline (hours)" hint="How long this document takes to write by hand."><Input type="number" min={0} max={500} step={0.5} value={edit.manualEffortHours} onChange={(e) => setEdit({ ...edit, manualEffortHours: Number(e.target.value) })} /></Field>
            <div className="md:col-span-2"><Field label="AI writing instructions"><Textarea value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} /></Field></div>
            <fieldset className="md:col-span-2">
              <legend className="mb-2 text-[13px] font-medium">Sections ({edit.sections.length} selected) — cover page, document information, revision history and table of contents are always included.</legend>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {all.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 rounded px-2 py-1 text-[13px] hover:bg-surface">
                    <input type="checkbox" checked={edit.sections.includes(s.key)} onChange={(e) => setEdit({ ...edit, sections: e.target.checked ? all.map((x) => x.key).filter((k) => k === s.key || edit.sections.includes(k)) : edit.sections.filter((k) => k !== s.key) })} />
                    {s.title}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Active (available to employees)</label>
          </div>
        )}
      </Modal>
    </>
  );
}
