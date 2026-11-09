import { CheckCircle2, XCircle, Send, Undo2, Globe, MessageSquare } from "lucide-react";
import { fmtDateTime } from "@/lib/client/api";
import { EmptyState } from "@/components/shared/ui";
import type { DocumentApproval } from "@/types";

const META = {
  submitted: { label: "Submitted for review", icon: Send, color: "text-brand-600 bg-brand-50" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-600 bg-red-50" },
  changes_requested: { label: "Changes requested", icon: Undo2, color: "text-amber-700 bg-amber-50" },
  published: { label: "Published", icon: Globe, color: "text-navy-800 bg-slate-100" },
  comment: { label: "Comment", icon: MessageSquare, color: "text-muted bg-slate-100" },
};

export function ApprovalTimeline({ items }: { items: (DocumentApproval & { actorName: string })[] }) {
  if (!items.length) return <EmptyState title="No approval activity yet" message="Submit the document for approval to start the review." />;
  return (
    <ol className="relative space-y-4 border-l border-line pl-6">
      {items.map((a) => {
        const m = META[a.action] || META.comment;
        return (
          <li key={a.id} className="relative">
            <span className={`absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full ${m.color}`}><m.icon className="h-3.5 w-3.5" /></span>
            <p className="text-[13px]"><strong>{m.label}</strong> by {a.actorName} <span className="text-muted">· v{a.versionNumber} · {fmtDateTime(a.createdAt)}</span></p>
            {a.comments && <p className="mt-1 rounded-md bg-surface p-2 text-[13px]">{a.comments}</p>}
          </li>
        );
      })}
    </ol>
  );
}
