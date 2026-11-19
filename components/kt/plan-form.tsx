"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { useToast } from "@/components/shared/toast";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/shared/ui";
import type { EmployeeProfile, Project } from "@/types";

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export function PlanForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const people = useApi<{ items: EmployeeProfile[] }>(open ? "/api/employees" : null);
  const projects = useApi<{ items: Project[] }>(open ? "/api/projects" : null);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ employeeId: "", successorId: "", managerId: "", noticeStart: today, lastWorkingDay: addDays(today, 30), notes: "" });
  const [modules, setModules] = useState([{ moduleName: "", projectId: "" }]);
  const [saving, setSaving] = useState(false);
  const active = useMemo(() => (people.data?.items || []).filter((p) => p.active), [people.data]);

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ item: { id: string } }>("/api/kt-plans", {
        body: { ...f, successorId: f.successorId || undefined, managerId: f.managerId || undefined, modules: modules.filter((m) => m.moduleName.trim()) },
      });
      toast.success("KT plan created with a task list and a handover request per module.");
      onCreated(r.item.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const person = (k: "employeeId" | "successorId" | "managerId", label: string, required = false) => (
    <Field label={label} required={required} htmlFor={k}>
      <Select id={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
        <option value="">{required ? "Select…" : "— none —"}</option>
        {active.map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.userName})</option>)}
      </Select>
    </Field>
  );

  return (
    <Modal wide open={open} onClose={onClose} title="Start notice-period KT plan"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} onClick={save} disabled={!f.employeeId || !modules.some((m) => m.moduleName.trim() && m.projectId)}>Create plan</Button></>}>
      <div className="grid gap-4 md:grid-cols-3">
        {person("employeeId", "Employee on notice", true)}
        {person("successorId", "Successor (receives the knowledge)")}
        {person("managerId", "Manager (final sign-off)")}
        <Field label="Notice start" required htmlFor="ns"><Input id="ns" type="date" value={f.noticeStart} onChange={(e) => setF({ ...f, noticeStart: e.target.value, lastWorkingDay: addDays(e.target.value, 30) })} /></Field>
        <Field label="Last working day" required htmlFor="lwd" hint="Default: notice start + 30 days"><Input id="lwd" type="date" value={f.lastWorkingDay} onChange={(e) => setF({ ...f, lastWorkingDay: e.target.value })} /></Field>
      </div>
      <fieldset className="mt-5">
        <legend className="mb-2 text-[13px] font-semibold">Modules / projects to hand over</legend>
        <p className="mb-2 text-[12px] text-muted">Each module gets a handover request for the leaving employee to fill in and generate with AI, plus a walkthrough task.</p>
        <div className="space-y-2">
          {modules.map((m, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-line bg-surface/50 p-2 md:flex-row">
              <Input aria-label={`Module ${i + 1} name`} placeholder="Module name, e.g. HRSD Case Routing" value={m.moduleName} onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, moduleName: e.target.value } : x)))} />
              <Select aria-label={`Module ${i + 1} project`} value={m.projectId} onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, projectId: e.target.value } : x)))}>
                <option value="">Project…</option>
                {projects.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove module" disabled={modules.length === 1} onClick={() => setModules(modules.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-1 text-brand-600" icon={Plus} onClick={() => setModules([...modules, { moduleName: "", projectId: "" }])}>Add module</Button>
      </fieldset>
      <div className="mt-4"><Field label="Notes (optional)"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. Resigned; joining another company. Critical: payroll integration." /></Field></div>
    </Modal>
  );
}
