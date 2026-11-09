"use client";
import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { api, useApi, fmtDate } from "@/lib/client/api";
import { useToast } from "@/components/shared/toast";
import { Badge, Button, Card, ErrorState, Field, Input, Modal, PageHeader, Select, Skeleton, Textarea } from "@/components/shared/ui";
import { DataTable, type Column } from "@/components/shared/data-table";
import type { EmployeeProfile, Project } from "@/types";

type P = Omit<Project, "id" | "createdAt" | "updatedAt"> & { id?: string };
const blank: P = { name: "", projectCode: "", applicationName: "", department: "", ownerId: "", description: "", status: "active" };
const STATUS = { active: "green", on_hold: "amber", completed: "gray" } as const;

export default function ProjectsPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ items: Project[] }>("/api/projects");
  const people = useApi<{ items: EmployeeProfile[] }>("/api/employees");
  const names = new Map((people.data?.items || []).map((p) => [p.id, p.fullName]));
  const [edit, setEdit] = useState<P | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      const { id, ...body } = edit;
      const payload = { ...body, ownerId: body.ownerId || undefined };
      if (id) await api(`/api/projects/${id}`, { method: "PATCH", body: payload });
      else await api("/api/projects", { body: payload });
      toast.success(id ? "Project updated." : "Project created.");
      setEdit(null);
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  }

  const cols: Column<Project>[] = [
    { key: "name", header: "Project", render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { key: "code", header: "Project ID", render: (r) => <code className="text-[12px]">{r.projectCode || "—"}</code> },
    { key: "app", header: "Application", render: (r) => r.applicationName },
    { key: "dept", header: "Department", render: (r) => r.department, sortValue: (r) => r.department },
    { key: "owner", header: "Owner", render: (r) => names.get(r.ownerId) || "—" },
    { key: "status", header: "Status", render: (r) => <Badge tone={STATUS[r.status] || "gray"}>{r.status.replace("_", " ")}</Badge> },
    { key: "created", header: "Created", render: (r) => fmtDate(r.createdAt), sortValue: (r) => r.createdAt },
    { key: "act", header: "", render: (r) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEdit({ ...r }); }}>Edit</Button> },
  ];

  return (
    <>
      <PageHeader title="Projects" crumbs={[{ label: "Admin Portal", href: "/admin/dashboard" }, { label: "Projects" }]} actions={<Button variant="primary" icon={FolderPlus} onClick={() => setEdit({ ...blank })}>Add project</Button>} />
      <Card padded={false}>
        {loading && !data ? <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : (
          <DataTable rows={data?.items || []} columns={cols} searchText={(r) => `${r.name} ${r.projectCode} ${r.applicationName} ${r.department}`}
            filters={[{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "on_hold", label: "On hold" }, { value: "completed", label: "Completed" }], test: (r, v) => r.status === v }]} />
        )}
      </Card>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? "Edit project" : "Add project"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Project name" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Project ID"><Input value={edit.projectCode} onChange={(e) => setEdit({ ...edit, projectCode: e.target.value })} /></Field>
            <Field label="Application"><Input value={edit.applicationName} onChange={(e) => setEdit({ ...edit, applicationName: e.target.value })} /></Field>
            <Field label="Department"><Input value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })} /></Field>
            <Field label="Owner"><Select value={edit.ownerId} onChange={(e) => setEdit({ ...edit, ownerId: e.target.value })}><option value="">—</option>{people.data?.items.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</Select></Field>
            <Field label="Status"><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Project["status"] })}><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option></Select></Field>
            <div className="md:col-span-2"><Field label="Description"><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field></div>
          </div>
        )}
      </Modal>
    </>
  );
}
