"use client";
import Link from "next/link";
import { UserMinus } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { Countdown, ProgressBar, RiskBadge, type Progress } from "@/components/kt/kt-ui";

interface Row { id: string; number: string; employeeName: string; successorName: string; status: string; myRole: string; progress: Progress }

/** Active notice-period KT plans the user takes part in (all active plans for HR on the admin dashboard). */
export function KtBanner({ area }: { area: "admin" | "employee" }) {
  const { data } = useApi<{ items: Row[] }>("/api/kt-plans");
  const active = (data?.items || []).filter((p) => p.status === "active");
  if (!active.length) return null;
  return (
    <section className="mb-5 rounded-lg border border-ai-100 bg-ai-50/60 p-4" aria-label="Notice period KT">
      <div className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold text-navy-900">
        <UserMinus className="h-4 w-4 text-ai-600" />
        {area === "admin" ? `Employees on notice period (${active.length})` : "Your exit handovers"}
        <Link href={`/${area}/kt-plans`} className="ml-auto text-[12.5px] font-medium text-brand-600">View all</Link>
      </div>
      <ul className="space-y-2">
        {active.slice(0, 5).map((p) => (
          <li key={p.id}>
            <Link href={`/${area}/kt-plans/${p.id}`} className="flex flex-wrap items-center gap-3 rounded-md bg-white px-3 py-2 text-[13px] hover:bg-brand-50/60">
              <span className="min-w-[180px] font-medium">
                {area === "employee" && p.myRole === "leaver" ? "Your handover" : p.employeeName}
                {area === "employee" && p.myRole === "successor" && <span className="font-normal text-muted"> (you are the successor)</span>}
              </span>
              <Countdown daysLeft={p.progress.daysLeft} status={p.status} />
              <ProgressBar percent={p.progress.percent} />
              <RiskBadge risk={p.progress.risk} status={p.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
