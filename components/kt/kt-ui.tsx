"use client";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Badge, cx } from "@/components/shared/ui";

export interface Progress { total: number; done: number; percent: number; daysLeft: number; overdue: number; risk: "low" | "medium" | "high" }

export function RiskBadge({ risk, status }: { risk: Progress["risk"]; status: string }) {
  if (status === "completed") return <Badge tone="green"><CheckCircle2 className="h-3 w-3" />Completed</Badge>;
  if (status === "cancelled") return <Badge tone="gray">Cancelled</Badge>;
  if (risk === "high") return <Badge tone="red"><AlertTriangle className="h-3 w-3" />High risk</Badge>;
  if (risk === "medium") return <Badge tone="amber"><Clock className="h-3 w-3" />Tasks overdue</Badge>;
  return <Badge tone="blue">On track</Badge>;
}

export function Countdown({ daysLeft, status }: { daysLeft: number; status: string }) {
  if (status !== "active") return <span className="text-muted">—</span>;
  const tone = daysLeft < 0 ? "text-red-700" : daysLeft <= 7 ? "text-amber-700" : "text-ink";
  return <span className={cx("font-medium tabular-nums", tone)}>{daysLeft < 0 ? `${-daysLeft} days past last day` : daysLeft === 0 ? "Last day today" : `${daysLeft} days left`}</span>;
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 rounded-full bg-slate-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx("h-2 rounded-full", percent >= 70 ? "bg-emerald-600" : "bg-brand-600")} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[12px] tabular-nums text-muted">{percent}%</span>
    </div>
  );
}

export const OWNER_LABEL = { leaver: "Leaving employee", successor: "Successor", manager: "Manager" } as const;
