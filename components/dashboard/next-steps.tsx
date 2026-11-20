"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ListChecks } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { Skeleton, cx } from "@/components/shared/ui";

interface Step { title: string; detail: string; href: string; tone: "red" | "amber" | "blue" | "purple" | "green" }

const TONE = {
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  blue: "border-l-brand-600",
  purple: "border-l-ai-600",
  green: "border-l-emerald-600",
};

/** "Your next steps": the few things this person should do now, most urgent first. */
export function NextSteps({ area }: { area: "employee" | "admin" }) {
  const { data, loading } = useApi<{ items: Step[] }>(`/api/next-steps?area=${area}`);
  return (
    <section className="mb-5 rounded-lg border border-line bg-white" aria-label="Your next steps">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <ListChecks className="h-4 w-4 text-brand-600" />
        <h2 className="text-sm font-semibold text-navy-900">Your next steps</h2>
      </header>
      {loading && !data ? (
        <div className="space-y-2 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      ) : !data?.items.length ? (
        <p className="flex items-center gap-2 px-4 py-4 text-[13px] text-muted"><CheckCircle2 className="h-4 w-4 text-emerald-600" />You’re all caught up. Nothing needs your action right now.</p>
      ) : (
        <ol className="divide-y divide-line">
          {data.items.map((s, i) => (
            <li key={i}>
              <Link href={s.href} className={cx("flex items-center gap-3 border-l-4 px-4 py-3 hover:bg-brand-50/50", TONE[s.tone])}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-[12px] font-semibold text-navy-900">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{s.title}</span>
                  <span className="block text-[12px] text-muted">{s.detail}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
