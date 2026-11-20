"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, CircleDot, FileText, Plus, Sparkles, ShieldCheck, Trash2, UserCheck, XCircle } from "lucide-react";
import { api, fmtDate, fmtDateTime, useApi } from "@/lib/client/api";
import { useToast } from "@/components/shared/toast";
import { Badge, Button, Card, ErrorState, Field, Input, Modal, PageHeader, PageSkeleton, Select, StateBadge, Textarea, cx } from "@/components/shared/ui";
import { Countdown, OWNER_LABEL, ProgressBar, RiskBadge, type Progress } from "@/components/kt/kt-ui";
import type { DocState, KtPlan, KtTask } from "@/types";

interface Bundle {
  plan: KtPlan;
  role: "admin" | "leaver" | "successor" | "manager";
  tasks: KtTask[];
  people: Record<string, string>;
  docs: Record<string, { id: string; state: DocState | ""; title: string }>;
  progress: Progress;
}

const STATUS_ICON = { todo: Circle, in_progress: CircleDot, done: CheckCircle2 };
const STATUS_LABEL = { todo: "To do", in_progress: "In progress", done: "Done" };

export function PlanDetail({ id, area }: { id: string; area: "admin" | "employee" }) {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<Bundle>(`/api/kt-plans/${id}`);
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", dueDate: "", owner: "leaver", week: 1 });

  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error || "Not found"} onRetry={reload} />;
  const { plan, role, tasks, people, docs, progress } = data;
  const active = plan.status === "active";
  const canManage = active && (role === "admin" || role === "manager");
  const canTick = active && role !== null;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  };
  const setStatus = (t: KtTask, status: KtTask["status"]) => run(t.id, async () => {
    await api(`/api/kt-tasks/${t.id}`, { method: "PATCH", body: { status } });
    await reload();
  });
  const removeTask = (t: KtTask) => run(t.id, async () => {
    await api(`/api/kt-tasks/${t.id}`, { method: "DELETE" });
    await reload();
  });
  const sign = (as: "successor" | "manager") => run(`sign-${as}`, async () => {
    await api(`/api/kt-plans/${id}/signoff`, { body: { as } });
    toast.success(as === "successor" ? "Handover confirmed." : "Final sign-off recorded. The exit handover is complete.");
    await reload();
  });
  const summary = () => run("summary", async () => {
    const r = await api<{ html: string }>("/api/ai/kt-summary", { body: { planId: id } });
    setData({ ...data, plan: { ...plan, summary: r.html } });
    toast.success("Exit KT summary generated.");
  });
  const cancel = () => run("cancel", async () => {
    await api(`/api/kt-plans/${id}`, { method: "PATCH", body: { status: "cancelled" } });
    await reload();
  });
  const add = () => run("add", async () => {
    await api(`/api/kt-plans/${id}/tasks`, { body: { ...newTask, week: Number(newTask.week) } });
    setAdding(false);
    setNewTask({ title: "", description: "", dueDate: "", owner: "leaver", week: 1 });
    await reload();
  });

  const weeks = [...new Set(tasks.map((t) => t.week))].sort((a, b) => a - b);
  const today = new Date().toISOString().slice(0, 10);
  const docLink = (requestId: string) => {
    const d = docs[requestId];
    if (!d) return null;
    if (d.id) return <Link href={`/${area}/documents/${d.id}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-600"><FileText className="h-3.5 w-3.5" />Open document</Link>;
    if (role === "leaver") return <Link href={`/employee/new-request?id=${requestId}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ai-600"><Sparkles className="h-3.5 w-3.5" />Fill in &amp; generate</Link>;
    return <span className="text-[12px] text-muted">Not generated yet</span>;
  };

  return (
    <>
      <PageHeader
        title={`Exit handover: ${people[plan.employeeId] || ""}`}
        subtitle={`${plan.number} · Notice ${fmtDate(plan.noticeStart)} → last working day ${fmtDate(plan.lastWorkingDay)}`}
        crumbs={[{ label: area === "admin" ? "Admin Portal" : "Employee Portal", href: `/${area}/dashboard` }, { label: area === "admin" ? "Exit Handovers" : "My Exit Handovers", href: `/${area}/kt-plans` }, { label: plan.number }]}
        actions={
          <>
            <RiskBadge risk={progress.risk} status={plan.status} />
            {["admin", "manager", "leaver"].includes(role) && <Button size="sm" variant="ai" icon={Sparkles} loading={busy === "summary"} onClick={summary}>AI exit summary</Button>}
            {canManage && <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>Add task</Button>}
            {role === "admin" && active && <Button size="sm" variant="ghost" icon={XCircle} loading={busy === "cancel"} onClick={cancel}>Cancel plan</Button>}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-line bg-white p-4"><p className="text-[12.5px] text-muted">Countdown</p><p className="mt-1 text-lg"><Countdown daysLeft={progress.daysLeft} status={plan.status} /></p></div>
        <div className="rounded-lg border border-line bg-white p-4"><p className="text-[12.5px] text-muted">Progress</p><div className="mt-2"><ProgressBar percent={progress.percent} /></div><p className="mt-1 text-[12px] text-muted">{progress.done} of {progress.total} tasks done</p></div>
        <div className="rounded-lg border border-line bg-white p-4"><p className="text-[12.5px] text-muted">Overdue tasks</p><p className={cx("mt-1 text-lg font-semibold", progress.overdue ? "text-amber-700" : "text-navy-900")}>{progress.overdue}</p></div>
        <div className="rounded-lg border border-line bg-white p-4 text-[13px]">
          <p><span className="text-muted">Leaving:</span> <strong>{people[plan.employeeId]}</strong></p>
          <p><span className="text-muted">Successor:</span> {people[plan.successorId] || "Not set"}</p>
          <p><span className="text-muted">Manager:</span> {people[plan.managerId] || "Not set"}</p>
          <p className="mt-1"><Badge>Your role: {role === "leaver" ? "Leaving employee" : role}</Badge></p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {weeks.map((w) => (
            <Card key={w} title={`Week ${w}`} padded={false}>
              <ul className="divide-y divide-line">
                {tasks.filter((t) => t.week === w).map((t) => {
                  const Icon = STATUS_ICON[t.status];
                  const overdue = t.status !== "done" && t.dueDate < today;
                  return (
                    <li key={t.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center">
                      <Icon className={cx("h-4 w-4 shrink-0", t.status === "done" ? "text-emerald-600" : t.status === "in_progress" ? "text-brand-600" : "text-slate-400")} />
                      <div className="min-w-0 flex-1">
                        <p className={cx("text-[13.5px] font-medium", t.status === "done" && "text-muted line-through")}>{t.title}</p>
                        <p className="text-[12px] text-muted">{t.description}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
                          <Badge tone={t.owner === "leaver" ? "purple" : t.owner === "successor" ? "blue" : "navy"}>{OWNER_LABEL[t.owner]}</Badge>
                          <span className={overdue ? "font-medium text-red-700" : "text-muted"}>Due {fmtDate(t.dueDate)}{overdue ? " · overdue" : ""}</span>
                          {t.requestId && <>{docLink(t.requestId)}{docs[t.requestId]?.state && <StateBadge state={docs[t.requestId].state as DocState} />}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select aria-label={`Status of ${t.title}`} className="w-[140px]" value={t.status} disabled={!canTick || busy === t.id} onChange={(e) => setStatus(t, e.target.value as KtTask["status"])}>
                          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                        {canManage && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${t.title}`} onClick={() => removeTask(t)} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card title="Sign-off">
            <ol className="space-y-3 text-[13px]">
              <li className="flex items-start gap-2">
                {plan.successorSignedAt ? <UserCheck className="mt-0.5 h-4 w-4 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 text-slate-400" />}
                <div className="flex-1">
                  <p className="font-medium">1. Successor confirms the handover</p>
                  <p className="text-[12px] text-muted">{plan.successorSignedAt ? `Confirmed ${fmtDateTime(plan.successorSignedAt)}` : plan.successorId ? `Waiting for ${people[plan.successorId]}` : "No successor assigned"}</p>
                  {role === "successor" && active && !plan.successorSignedAt && <Button size="sm" variant="success" className="mt-2" icon={UserCheck} loading={busy === "sign-successor"} onClick={() => sign("successor")}>I received the knowledge</Button>}
                </div>
              </li>
              <li className="flex items-start gap-2">
                {plan.managerSignedAt ? <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 text-slate-400" />}
                <div className="flex-1">
                  <p className="font-medium">2. Manager / HR final sign-off</p>
                  <p className="text-[12px] text-muted">{plan.managerSignedAt ? `Signed ${fmtDateTime(plan.managerSignedAt)}` : "Completes the plan"}</p>
                  {(role === "manager" || role === "admin") && active && <Button size="sm" variant="primary" className="mt-2" icon={ShieldCheck} loading={busy === "sign-manager"} disabled={Boolean(plan.successorId && !plan.successorSignedAt)} onClick={() => sign("manager")}>Final sign-off</Button>}
                </div>
              </li>
            </ol>
            {progress.percent < 100 && active && <p className="mt-3 rounded-md bg-amber-50 p-2 text-[12px] text-amber-900">{progress.total - progress.done} task(s) are still open.</p>}
          </Card>
          {plan.notes && <Card title="Notes"><p className="whitespace-pre-wrap text-[13px]">{plan.notes}</p></Card>}
          {plan.summary && <Card title="AI exit summary" actions={<Badge tone="purple">Groq</Badge>}><div className="chat-md text-[13px]" dangerouslySetInnerHTML={{ __html: plan.summary }} /></Card>}
        </aside>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add task" footer={<><Button onClick={() => setAdding(false)}>Cancel</Button><Button variant="primary" loading={busy === "add"} disabled={!newTask.title || !newTask.dueDate} onClick={add}>Add</Button></>}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><Field label="Title" required><Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} /></Field></div>
          <div className="md:col-span-2"><Field label="Description"><Textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} /></Field></div>
          <Field label="Due date" required><Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} /></Field>
          <Field label="Owner"><Select value={newTask.owner} onChange={(e) => setNewTask({ ...newTask, owner: e.target.value })}>{Object.entries(OWNER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Week"><Input type="number" min={1} max={12} value={newTask.week} onChange={(e) => setNewTask({ ...newTask, week: Number(e.target.value) })} /></Field>
        </div>
      </Modal>
    </>
  );
}
