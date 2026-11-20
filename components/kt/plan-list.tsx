"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";
import { useApi, fmtDate } from "@/lib/client/api";
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton } from "@/components/shared/ui";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Countdown, ProgressBar, RiskBadge, type Progress } from "@/components/kt/kt-ui";
import { PlanForm } from "@/components/kt/plan-form";

interface Row {
  id: string; number: string; employeeName: string; successorName: string; managerName: string; lastWorkingDay: string; noticeStart: string;
  status: string; myRole: string; progress: Progress;
}

export function PlanList({ area }: { area: "admin" | "employee" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useApi<{ items: Row[] }>("/api/kt-plans");
  const cols: Column<Row>[] = [
    { key: "num", header: "Plan", render: (r) => <span className="font-mono text-[12px]">{r.number}</span> },
    { key: "emp", header: "Employee on notice", render: (r) => <span className="font-medium">{r.employeeName}</span>, sortValue: (r) => r.employeeName },
    { key: "succ", header: "Successor", render: (r) => r.successorName || <span className="text-muted">Not set</span> },
    ...(area === "employee" ? [{ key: "role", header: "My role", render: (r: Row) => <Badge>{r.myRole === "leaver" ? "Leaving" : r.myRole}</Badge> }] : []),
    { key: "lwd", header: "Last working day", render: (r) => fmtDate(r.lastWorkingDay), sortValue: (r) => r.lastWorkingDay },
    { key: "left", header: "Countdown", render: (r) => <Countdown daysLeft={r.progress.daysLeft} status={r.status} />, sortValue: (r) => r.progress.daysLeft },
    { key: "prog", header: "Progress", render: (r) => <ProgressBar percent={r.progress.percent} />, sortValue: (r) => r.progress.percent },
    { key: "risk", header: "Status", render: (r) => <RiskBadge risk={r.progress.risk} status={r.status} /> },
  ];
  return (
    <>
      <PageHeader
        title={area === "admin" ? "Exit Handovers" : "My Exit Handovers"}
        subtitle={area === "admin" ? "Employees serving their notice period: the 30-day handover plan, tasks, documents and sign-off for each person." : "Exit handovers you are part of: as the person leaving, the successor taking over, or the manager."}
        crumbs={[{ label: area === "admin" ? "Admin Portal" : "Employee Portal", href: `/${area}/dashboard` }, { label: area === "admin" ? "Exit Handovers" : "My Exit Handovers" }]}
        actions={area === "admin" && <Button variant="primary" icon={UserMinus} onClick={() => setOpen(true)}>Start exit handover</Button>}
      />
      <Card padded={false}>
        {loading && !data ? <div className="space-y-2 p-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : (
          <DataTable rows={data?.items || []} columns={cols} searchText={(r) => `${r.number} ${r.employeeName} ${r.successorName}`}
            filters={[{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }], test: (r, v) => r.status === v }]}
            emptyTitle={area === "admin" ? "No exit handovers yet" : "You are not part of any exit handover"}
            emptyMessage={area === "admin" ? "When an employee resigns, start an exit handover. It creates a 4-week task plan and a module handover for each module they own." : undefined}
            onRowClick={(r) => router.push(`/${area}/kt-plans/${r.id}`)} />
        )}
      </Card>
      {area === "admin" && <PlanForm open={open} onClose={() => setOpen(false)} onCreated={(id) => router.push(`/admin/kt-plans/${id}`)} />}
    </>
  );
}
