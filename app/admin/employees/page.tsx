"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { api, useApi, fmtDate } from "@/lib/client/api";
import { useToast } from "@/components/shared/toast";
import { Badge, Button, Card, ErrorState, Field, Input, Modal, PageHeader, Select, Skeleton } from "@/components/shared/ui";
import { DataTable, type Column } from "@/components/shared/data-table";
import type { EmployeeProfile } from "@/types";

const blank = { userName: "", fullName: "", email: "", department: "", jobTitle: "", role: "employee" as const, active: true };

export default function EmployeesPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ items: EmployeeProfile[] }>("/api/employees");
  const [edit, setEdit] = useState<(Omit<EmployeeProfile, "id" | "createdAt" | "role"> & { id?: string; role: "employee" | "admin" }) | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      const { id, ...body } = edit;
      if (id) { const { userName, ...rest } = body; void userName; await api(`/api/employees/${id}`, { method: "PATCH", body: rest }); }
      else await api("/api/employees", { body });
      toast.success(id ? "Employee updated." : "Employee profile created.");
      setEdit(null);
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  }

  const cols: Column<EmployeeProfile>[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.fullName}</span>, sortValue: (r) => r.fullName },
    { key: "user", header: "User name", render: (r) => <code className="text-[12px]">{r.userName}</code>, sortValue: (r) => r.userName },
    { key: "dept", header: "Department", render: (r) => r.department, sortValue: (r) => r.department },
    { key: "title", header: "Job title", render: (r) => r.jobTitle },
    { key: "role", header: "Role", render: (r) => <Badge tone={r.role === "admin" ? "navy" : "blue"}>{r.role}</Badge> },
    { key: "active", header: "Status", render: (r) => <Badge tone={r.active ? "green" : "gray"}>{r.active ? "Active" : "Inactive"}</Badge> },
    { key: "since", header: "Added", render: (r) => fmtDate(r.createdAt), sortValue: (r) => r.createdAt },
    { key: "act", header: "", render: (r) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEdit({ ...r }); }}>Edit</Button> },
  ];

  return (
    <>
      <PageHeader title="Employees" subtitle="HandoverAI profiles. The user name must match the person’s ServiceNow user name; the role controls portal access." crumbs={[{ label: "Admin Portal", href: "/admin/dashboard" }, { label: "Employees" }]} actions={<Button variant="primary" icon={UserPlus} onClick={() => setEdit({ ...blank })}>Add employee</Button>} />
      <Card padded={false}>
        {loading && !data ? <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : (
          <DataTable rows={data?.items || []} columns={cols} searchText={(r) => `${r.fullName} ${r.userName} ${r.department} ${r.email}`}
            filters={[{ key: "role", label: "Role", options: [{ value: "employee", label: "Employee" }, { value: "admin", label: "Admin" }], test: (r, v) => r.role === v }, { key: "active", label: "Status", options: [{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }], test: (r, v) => r.active === (v === "1") }]} />
        )}
      </Card>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? "Edit employee" : "Add employee"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Full name" required><Input value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} /></Field>
            <Field label="ServiceNow user name" required><Input value={edit.userName} disabled={Boolean(edit.id)} onChange={(e) => setEdit({ ...edit, userName: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Department"><Input value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })} /></Field>
            <Field label="Job title"><Input value={edit.jobTitle} onChange={(e) => setEdit({ ...edit, jobTitle: e.target.value })} /></Field>
            <Field label="Role" required><Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as "employee" | "admin" })}><option value="employee">Employee</option><option value="admin">Admin</option></Select></Field>
            <label className="flex items-center gap-2 text-[13px] md:col-span-2"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Active (can sign in)</label>
          </div>
        )}
      </Modal>
    </>
  );
}
