"use client";
import { forwardRef, useEffect } from "react";
import Link from "next/link";
import { Loader2, X, Inbox, ChevronRight } from "lucide-react";
import type { DocState } from "@/types";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "ai" | "success";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "secondary", size = "md", loading, icon: Icon, className, children, disabled, ...rest },
  ref
) {
  const v = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 border-transparent",
    secondary: "bg-white text-ink border-line hover:bg-surface",
    ghost: "bg-transparent border-transparent text-muted hover:bg-surface hover:text-ink",
    danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
    ai: "bg-ai-600 text-white hover:bg-ai-700 border-transparent",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 border-transparent",
  }[variant];
  const s = size === "sm" ? "h-8 px-2.5 text-[13px] gap-1.5" : "h-9 px-3.5 text-sm gap-2";
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx("inline-flex items-center justify-center rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500", v, s, className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
});

export function Card({ className, children, title, actions, padded = true }: { className?: string; children: React.ReactNode; title?: React.ReactNode; actions?: React.ReactNode; padded?: boolean }) {
  return (
    <section className={cx("rounded-lg border border-line bg-white", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-navy-900">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "gray", className }: { children: React.ReactNode; tone?: "gray" | "blue" | "green" | "amber" | "red" | "purple" | "navy"; className?: string }) {
  const t = {
    gray: "bg-slate-100 text-slate-700",
    blue: "bg-brand-100 text-brand-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    purple: "bg-ai-100 text-ai-700",
    navy: "bg-navy-900 text-white",
  }[tone];
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-medium", t, className)}>{children}</span>;
}

const STATE_TONE: Record<DocState, Parameters<typeof Badge>[0]["tone"]> = {
  draft: "gray", ai_generated: "purple", under_review: "blue", changes_requested: "amber", rejected: "red", approved: "green", published: "navy",
};
const STATE_LABEL: Record<DocState, string> = {
  draft: "Draft", ai_generated: "AI Generated", under_review: "Under Review", changes_requested: "Changes Requested", rejected: "Rejected", approved: "Approved", published: "Published",
};
export function StateBadge({ state }: { state: DocState | "" | "not_generated" }) {
  if (!state || state === "not_generated") return <Badge tone="gray">Not generated</Badge>;
  return <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>;
}
export const stateLabel = (s: DocState) => STATE_LABEL[s];

export function KpiCard({ label, value, icon: Icon, hint, tone = "blue" }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; hint?: string; tone?: "blue" | "purple" | "green" | "amber" | "navy" }) {
  const t = { blue: "bg-brand-50 text-brand-600", purple: "bg-ai-50 text-ai-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", navy: "bg-slate-100 text-navy-800" }[tone];
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        <span className={cx("rounded-md p-1.5", t)}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-900">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded bg-slate-200/70", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <Inbox className="h-8 w-8 text-slate-300" />
      <p className="mt-2 text-sm font-medium text-ink">{title}</p>
      {message && <p className="mt-1 max-w-sm text-[13px] text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
      <p className="font-medium">Could not load data</p>
      <p className="mt-1">{message}</p>
      {onRetry && <Button size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function PageHeader({ title, crumbs = [], actions, subtitle }: { title: string; crumbs?: { label: string; href?: string }[]; actions?: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-[12.5px] text-muted">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {c.href ? <Link href={c.href} className="hover:text-brand-600">{c.label}</Link> : <span className="text-ink">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-xl font-semibold text-navy-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx("flex max-h-[90vh] w-full flex-col rounded-lg bg-white shadow-xl", wide ? "max-w-5xl" : "max-w-lg")}>
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold text-navy-900">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded p-1 text-muted hover:bg-surface"><X className="h-4 w-4" /></button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

const fieldCls = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-surface";

export function Field({ label, hint, children, required, htmlFor }: { label: string; hint?: string; children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-ink">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(fieldCls, "h-9 py-0", className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...p }, ref) {
  return <textarea ref={ref} rows={rows} className={cx(fieldCls, className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return <select ref={ref} className={cx(fieldCls, "h-9 py-0", className)} {...p}>{children}</select>;
});

export function Spinner({ label }: { label?: string }) {
  return <span className="inline-flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />{label}</span>;
}
