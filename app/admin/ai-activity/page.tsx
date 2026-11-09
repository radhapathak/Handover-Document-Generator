"use client";
import { useState } from "react";
import { useApi, fmtDateTime } from "@/lib/client/api";
import { Badge, Button, Card, ErrorState, KpiCard, PageHeader, Skeleton } from "@/components/shared/ui";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Activity, AlertTriangle, Cpu, Timer } from "lucide-react";
import type { AiGenerationLog } from "@/types";

type Row = AiGenerationLog & { userName: string };

export default function AiActivityPage() {
  const [offset, setOffset] = useState(0);
  const { data, error, loading, reload } = useApi<{ items: Row[]; total: number }>(`/api/ai/logs?offset=${offset}`);
  const items = data?.items || [];
  const errors = items.filter((l) => l.status === "error").length;
  const tokens = items.reduce((s, l) => s + l.promptTokens + l.completionTokens, 0);
  const avg = items.length ? Math.round(items.reduce((s, l) => s + l.durationMs, 0) / items.length / 100) / 10 : 0;
  const cols: Column<Row>[] = [
    { key: "at", header: "Time", render: (r) => fmtDateTime(r.createdAt), sortValue: (r) => r.createdAt },
    { key: "op", header: "Operation", render: (r) => <code className="text-[12px]">{r.operation}</code>, sortValue: (r) => r.operation },
    { key: "user", header: "User", render: (r) => r.userName },
    { key: "model", header: "Model", render: (r) => <span className="text-[12px]">{r.model}</span> },
    { key: "tok", header: "Tokens (in / out)", render: (r) => <span className="tabular-nums">{r.promptTokens.toLocaleString()} / {r.completionTokens.toLocaleString()}</span>, sortValue: (r) => r.promptTokens + r.completionTokens },
    { key: "dur", header: "Duration", render: (r) => `${(r.durationMs / 1000).toFixed(1)} s`, sortValue: (r) => r.durationMs },
    { key: "status", header: "Status", render: (r) => r.status === "success" ? <Badge tone="green">Success</Badge> : <Badge tone="red" className="max-w-[260px] truncate" ><span title={r.errorMessage}>Error: {r.errorMessage}</span></Badge> },
  ];
  return (
    <>
      <PageHeader title="AI Generation Activity" subtitle="Every Groq call is logged to the AI Generation Log table." crumbs={[{ label: "Admin Portal", href: "/admin/dashboard" }, { label: "AI Activity" }]} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Calls (this page)" value={items.length} icon={Activity} tone="purple" hint={`${data?.total ?? 0} total`} />
        <KpiCard label="Errors" value={errors} icon={AlertTriangle} tone="amber" />
        <KpiCard label="Tokens used" value={tokens.toLocaleString()} icon={Cpu} />
        <KpiCard label="Avg. duration" value={`${avg} s`} icon={Timer} tone="navy" />
      </div>
      <Card padded={false}>
        {loading && !data ? <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : (
          <>
            <DataTable rows={items} columns={cols} pageSize={25} searchText={(r) => `${r.operation} ${r.userName} ${r.errorMessage}`}
              filters={[{ key: "status", label: "Status", options: [{ value: "success", label: "Success" }, { value: "error", label: "Error" }], test: (r, v) => r.status === v }]} emptyTitle="No AI activity yet" />
            {(data?.total || 0) > 50 && (
              <div className="flex justify-end gap-2 border-t border-line p-3">
                <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Newer</Button>
                <Button size="sm" disabled={offset + 50 >= (data?.total || 0)} onClick={() => setOffset(offset + 50)}>Older</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
