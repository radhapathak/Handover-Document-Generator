"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, FolderKanban, Boxes, FileText, Clock, CheckCircle2, Timer, RotateCcw, Sparkles, AlertTriangle } from "lucide-react";
import { useApi, fmtDate, fmtDateTime } from "@/lib/client/api";
import { Badge, Button, Card, EmptyState, ErrorState, Input, KpiCard, PageSkeleton, Select, StateBadge, stateLabel } from "@/components/shared/ui";
import { HorizontalBars, ManualVsAiChart, MonthlyDocsChart, StatusDonut, TurnaroundChart, type MonthRow } from "@/components/dashboard/charts";
import type { DocState } from "@/types";

interface Data {
  kpis: { totalEmployees: number; totalProjects: number; totalModules: number; documentsGenerated: number; pendingReviews: number; approvedDocuments: number; hoursSaved: number };
  charts: { byMonth: MonthRow[]; byProject: { name: string; value: number }[]; byAuthor: { name: string; value: number }[]; pendingVsApproved: { name: string; value: number }[] };
  pending: { id: string; title: string; authorName: string; projectName: string; submittedAt: string; issues: number }[];
  activity: { at: string; actor: string; action: string; documentId: string; title: string; comments: string }[];
  filterOptions: { projects: { id: string; name: string }[]; employees: { id: string; name: string }[]; modules: string[] };
  assumptions: { reviewHours: number };
}

const STATES: DocState[] = ["draft", "ai_generated", "under_review", "changes_requested", "rejected", "approved", "published"];
const ACTION_LABEL: Record<string, string> = { submitted: "submitted", approved: "approved", rejected: "rejected", changes_requested: "requested changes on", published: "published", comment: "commented on", ai_generated: "generated with AI", ai_error: "AI error on" };

export function AdminInsights({ mode }: { mode: "dashboard" | "analytics" }) {
  const [f, setF] = useState({ from: "", to: "", projectId: "", employeeId: "", module: "", state: "" });
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  const { data, error, loading, reload } = useApi<Data>(`/api/analytics${qs ? `?${qs}` : ""}`);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const filters = (
    <Card className="mb-5" padded={false}>
      <div className="flex flex-wrap items-end gap-2 p-3">
        <label className="text-[12px] font-medium text-muted">From<Input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} className="mt-0.5 w-[150px]" /></label>
        <label className="text-[12px] font-medium text-muted">To<Input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} className="mt-0.5 w-[150px]" /></label>
        <label className="text-[12px] font-medium text-muted">Project<Select value={f.projectId} onChange={(e) => set("projectId", e.target.value)} className="mt-0.5 w-[190px]"><option value="">All projects</option>{data?.filterOptions.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></label>
        <label className="text-[12px] font-medium text-muted">Employee<Select value={f.employeeId} onChange={(e) => set("employeeId", e.target.value)} className="mt-0.5 w-[170px]"><option value="">All employees</option>{data?.filterOptions.employees.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></label>
        <label className="text-[12px] font-medium text-muted">Module<Select value={f.module} onChange={(e) => set("module", e.target.value)} className="mt-0.5 w-[190px]"><option value="">All modules</option>{data?.filterOptions.modules.map((m) => <option key={m}>{m}</option>)}</Select></label>
        <label className="text-[12px] font-medium text-muted">Status<Select value={f.state} onChange={(e) => set("state", e.target.value)} className="mt-0.5 w-[160px]"><option value="">All statuses</option>{STATES.map((s) => <option key={s} value={s}>{stateLabel(s)}</option>)}</Select></label>
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setF({ from: "", to: "", projectId: "", employeeId: "", module: "", state: "" })}>Reset</Button>
      </div>
    </Card>
  );

  if (loading && !data) return <>{filters}<PageSkeleton /></>;
  if (error || !data) return <>{filters}<ErrorState message={error || "No data"} onRetry={reload} /></>;
  const k = data.kpis;

  return (
    <>
      {filters}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Total Employees" value={k.totalEmployees} icon={Users} tone="navy" />
        <KpiCard label="Total Projects" value={k.totalProjects} icon={FolderKanban} tone="navy" />
        <KpiCard label="Total Modules" value={k.totalModules} icon={Boxes} />
        <KpiCard label="Documents Generated" value={k.documentsGenerated} icon={FileText} tone="purple" />
        <KpiCard label="Pending Reviews" value={k.pendingReviews} icon={Clock} tone="amber" />
        <KpiCard label="Approved Documents" value={k.approvedDocuments} icon={CheckCircle2} tone="green" />
        <KpiCard label="Estimated Hours Saved" value={k.hoursSaved} icon={Timer} tone="purple" hint={`Manual baseline − (AI time + ${data.assumptions.reviewHours}h review)`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Documents generated monthly"><MonthlyDocsChart data={data.charts.byMonth} /></Card>
        <Card title="Pending vs approved documents">{data.charts.pendingVsApproved.every((x) => !x.value) ? <EmptyState title="No documents" /> : <StatusDonut data={data.charts.pendingVsApproved} />}</Card>
        {mode === "analytics" && (
          <>
            <Card title="Documents by project">{data.charts.byProject.length ? <HorizontalBars data={data.charts.byProject} label="Documents" /> : <EmptyState title="No data" />}</Card>
            <Card title="Employee documentation activity">{data.charts.byAuthor.length ? <HorizontalBars data={data.charts.byAuthor} color="#2563c9" label="Documents" /> : <EmptyState title="No data" />}</Card>
            <Card title="Manual vs AI documentation time (estimated)"><ManualVsAiChart data={data.charts.byMonth} /></Card>
            <Card title="Approval turnaround time"><TurnaroundChart data={data.charts.byMonth} /></Card>
          </>
        )}
      </div>

      {mode === "dashboard" && (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Card title="Pending approval requests" padded={false} actions={<Link href="/admin/approvals" className="text-[13px] font-medium text-brand-600">Open queue</Link>}>
            {data.pending.length === 0 ? <EmptyState title="Nothing waiting for review" /> : (
              <ul className="divide-y divide-line">
                {data.pending.slice(0, 6).map((d) => (
                  <li key={d.id}><Link href={`/admin/documents/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50/50">
                    <div className="min-w-0 flex-1"><p className="truncate text-[13.5px] font-medium">{d.title}</p><p className="text-[12px] text-muted">{d.authorName} · {d.projectName} · submitted {fmtDate(d.submittedAt)}</p></div>
                    {d.issues > 0 && <Badge tone="amber"><AlertTriangle className="h-3 w-3" />{d.issues}</Badge>}
                    <StateBadge state="under_review" />
                  </Link></li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Recent activity" padded={false}>
            {data.activity.length === 0 ? <EmptyState title="No activity yet" /> : (
              <ul className="divide-y divide-line">
                {data.activity.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                    {a.action.startsWith("ai") ? <Sparkles className={`mt-0.5 h-4 w-4 ${a.action === "ai_error" ? "text-red-600" : "text-ai-600"}`} /> : <FileText className="mt-0.5 h-4 w-4 text-muted" />}
                    <p className="flex-1"><strong>{a.actor}</strong> {ACTION_LABEL[a.action] || a.action} {a.documentId ? <Link className="text-brand-600" href={`/admin/documents/${a.documentId}`}>{a.title || "a document"}</Link> : <span>{a.title || "a request"}</span>}{a.comments && a.action !== "ai_generated" ? <span className="block text-[12px] text-muted">“{a.comments.slice(0, 140)}”</span> : null}</p>
                    <span className="whitespace-nowrap text-[12px] text-muted">{fmtDateTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
