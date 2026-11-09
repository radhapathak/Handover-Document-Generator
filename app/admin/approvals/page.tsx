"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useApi, fmtDate } from "@/lib/client/api";
import { Badge, Card, ErrorState, PageHeader, Skeleton, StateBadge, cx } from "@/components/shared/ui";
import { DataTable, type Column } from "@/components/shared/data-table";
import type { DocState } from "@/types";

interface Row { id: string; title: string; state: DocState; projectName: string; authorName: string; currentVersion: number; submittedAt: string; approvedAt: string; updatedAt: string; issues: number }

const TABS: { key: string; label: string; states: DocState[] }[] = [
  { key: "pending", label: "Pending review", states: ["under_review"] },
  { key: "returned", label: "Returned to author", states: ["changes_requested", "rejected"] },
  { key: "approved", label: "Approved (to publish)", states: ["approved"] },
  { key: "published", label: "Published", states: ["published"] },
];

export default function ApprovalsPage() {
  const router = useRouter();
  const [tab, setTab] = useState("pending");
  const { data, error, loading, reload } = useApi<{ items: Row[] }>("/api/documents");
  const rows = (data?.items || []).filter((d) => TABS.find((t) => t.key === tab)!.states.includes(d.state));
  const cols: Column<Row>[] = [
    { key: "title", header: "Document", render: (r) => <span className="font-medium">{r.title}</span>, sortValue: (r) => r.title },
    { key: "author", header: "Employee", render: (r) => r.authorName, sortValue: (r) => r.authorName },
    { key: "project", header: "Project", render: (r) => r.projectName, sortValue: (r) => r.projectName },
    { key: "ver", header: "Version", render: (r) => `v${r.currentVersion}` },
    { key: "issues", header: "Flags", render: (r) => (r.issues ? <Badge tone="amber"><AlertTriangle className="h-3 w-3" />{r.issues} section(s)</Badge> : <span className="text-muted">—</span>) },
    { key: "submitted", header: "Submitted", render: (r) => fmtDate(r.submittedAt), sortValue: (r) => r.submittedAt },
    { key: "state", header: "Status", render: (r) => <StateBadge state={r.state} /> },
  ];
  return (
    <>
      <PageHeader title="Approvals" subtitle="Review employee submissions: approve, reject or request changes with comments." crumbs={[{ label: "Admin Portal", href: "/admin/dashboard" }, { label: "Approvals" }]} />
      <div className="mb-3 flex flex-wrap gap-1" role="tablist">
        {TABS.map((t) => {
          const n = (data?.items || []).filter((d) => t.states.includes(d.state)).length;
          return <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cx("rounded-md px-3 py-1.5 text-[13px] font-medium", tab === t.key ? "bg-navy-900 text-white" : "bg-white text-muted hover:text-ink")}>{t.label} <span className="ml-1 opacity-70">{n}</span></button>;
        })}
      </div>
      <Card padded={false}>
        {loading && !data ? <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : (
          <DataTable rows={rows} columns={cols} searchText={(r) => `${r.title} ${r.authorName} ${r.projectName}`} emptyTitle="Nothing here" onRowClick={(r) => router.push(`/admin/documents/${r.id}`)} />
        )}
      </Card>
    </>
  );
}
