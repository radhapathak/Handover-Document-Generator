"use client";
import { useRouter } from "next/navigation";
import { useApi, fmtDate } from "@/lib/client/api";
import { Badge, Card, ErrorState, Skeleton, StateBadge, stateLabel } from "@/components/shared/ui";
import { DataTable, type Column } from "@/components/shared/data-table";
import type { DocState } from "@/types";

interface Row {
  id: string; number: string; title: string; documentType: string; projectName: string; requestedByName: string;
  documentId: string; documentState: DocState | ""; createdAt: string;
}

const STATES: DocState[] = ["draft", "ai_generated", "under_review", "changes_requested", "rejected", "approved", "published"];

/** Requests + their generated document status. Used by "My Documents" and admin "All Documents". */
export function DocumentList({ area }: { area: "employee" | "admin" }) {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<{ items: Row[] }>("/api/requests");
  const cols: Column<Row>[] = [
    { key: "number", header: "Request", render: (r) => <span className="font-mono text-[12px]">{r.number}</span>, sortValue: (r) => r.number },
    { key: "title", header: "Title", render: (r) => <span className="font-medium">{r.title}</span>, sortValue: (r) => r.title },
    { key: "project", header: "Project", render: (r) => r.projectName, sortValue: (r) => r.projectName },
    ...(area === "admin" ? [{ key: "by", header: "Employee", render: (r: Row) => r.requestedByName, sortValue: (r: Row) => r.requestedByName }] : []),
    { key: "type", header: "Type", render: (r) => <Badge>{r.documentType}</Badge> },
    { key: "state", header: "Status", render: (r) => <StateBadge state={r.documentState || "not_generated"} /> },
    { key: "created", header: "Created", render: (r) => fmtDate(r.createdAt), sortValue: (r) => r.createdAt },
  ];
  return (
    <Card padded={false}>
      {loading && !data ? <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : (
        <DataTable
          rows={data?.items || []}
          columns={cols}
          searchText={(r) => `${r.number} ${r.title} ${r.projectName} ${r.requestedByName}`}
          filters={[
            { key: "state", label: "Status", options: [{ value: "none", label: "Not generated" }, ...STATES.map((s) => ({ value: s, label: stateLabel(s) }))], test: (r, v) => (v === "none" ? !r.documentState : r.documentState === v) },
            { key: "project", label: "Project", options: [...new Set((data?.items || []).map((r) => r.projectName))].map((p) => ({ value: p, label: p })), test: (r, v) => r.projectName === v },
          ]}
          emptyTitle="No documentation requests"
          emptyMessage={area === "employee" ? "Create a new handover request to generate your first document." : undefined}
          onRowClick={(r) => router.push(r.documentId ? `/${area}/documents/${r.documentId}` : area === "employee" ? `/employee/new-request?id=${r.id}` : `/admin/documents`)}
        />
      )}
    </Card>
  );
}
