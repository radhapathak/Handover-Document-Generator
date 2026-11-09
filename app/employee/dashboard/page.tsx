"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, FileText, FilePen, Clock, CheckCircle2, Timer, FilePlus2, Sparkles, Files } from "lucide-react";
import { useApi, fmtDate } from "@/lib/client/api";
import { Button, Card, EmptyState, ErrorState, KpiCard, PageHeader, PageSkeleton, StateBadge } from "@/components/shared/ui";
import type { DocState } from "@/types";

interface Dash {
  kpis: { myProjects: number; documentsGenerated: number; draftDocuments: number; pendingApprovals: number; approvedDocuments: number; hoursSaved: number };
  recentRequests: { id: string; number: string; title: string; projectName: string; createdAt: string; documentId: string; documentState: DocState | "" }[];
  recentDocuments: { id: string; title: string; projectName: string; state: DocState; updatedAt: string; currentVersion: number }[];
  projectProgress: { projectId: string; projectName: string; total: number; approved: number; percent: number }[];
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<Dash>("/api/dashboard");
  return (
    <>
      <PageHeader
        title="Dashboard"
        crumbs={[{ label: "Employee Portal" }, { label: "Dashboard" }]}
        actions={
          <>
            <Link href="/employee/assistant"><Button icon={Sparkles}>AI Documentation Assistant</Button></Link>
            <Link href="/employee/documents"><Button icon={Files}>View My Documents</Button></Link>
            <Link href="/employee/new-request"><Button variant="primary" icon={FilePlus2}>Create New Handover</Button></Link>
          </>
        }
      />
      {loading && !data ? <PageSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="My Projects" value={data.kpis.myProjects} icon={FolderKanban} tone="navy" />
            <KpiCard label="Documents Generated" value={data.kpis.documentsGenerated} icon={FileText} tone="purple" />
            <KpiCard label="Draft Documents" value={data.kpis.draftDocuments} icon={FilePen} />
            <KpiCard label="Pending Approvals" value={data.kpis.pendingApprovals} icon={Clock} tone="amber" />
            <KpiCard label="Approved Documents" value={data.kpis.approvedDocuments} icon={CheckCircle2} tone="green" />
            <KpiCard label="Estimated Hours Saved" value={data.kpis.hoursSaved} icon={Timer} tone="purple" hint="vs. manual baseline" />
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2" title="Recent documentation requests" padded={false} actions={<Link href="/employee/documents" className="text-[13px] font-medium text-brand-600">View all</Link>}>
              {data.recentRequests.length === 0 ? (
                <EmptyState title="No requests yet" message="Create your first handover request to get started." action={<Link href="/employee/new-request"><Button variant="primary" icon={FilePlus2}>Create New Handover</Button></Link>} />
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentRequests.map((r) => (
                    <li key={r.id}>
                      <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50/50" onClick={() => router.push(r.documentId ? `/employee/documents/${r.documentId}` : `/employee/new-request?id=${r.id}`)}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium">{r.title}</p>
                          <p className="text-[12px] text-muted">{r.number} · {r.projectName} · {fmtDate(r.createdAt)}</p>
                        </div>
                        <StateBadge state={r.documentState || "not_generated"} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Project progress">
              {data.projectProgress.length === 0 ? <EmptyState title="No projects" /> : (
                <ul className="space-y-4">
                  {data.projectProgress.map((p) => (
                    <li key={p.projectId}>
                      <div className="flex justify-between text-[13px]"><span className="truncate font-medium">{p.projectName}</span><span className="text-muted">{p.approved}/{p.total} approved</span></div>
                      <div className="mt-1.5 h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-2 rounded-full bg-brand-600" style={{ width: `${p.percent}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card title="Recent generated documents" padded={false}>
            {data.recentDocuments.length === 0 ? <EmptyState title="No documents generated yet" /> : (
              <ul className="divide-y divide-line">
                {data.recentDocuments.map((d) => (
                  <li key={d.id}>
                    <Link href={`/employee/documents/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50/50">
                      <FileText className="h-4 w-4 text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium">{d.title}</p>
                        <p className="text-[12px] text-muted">{d.projectName} · v{d.currentVersion} · updated {fmtDate(d.updatedAt)}</p>
                      </div>
                      <StateBadge state={d.state} />
                    </Link>
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
