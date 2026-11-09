"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, FilePlus2, FileText, Sparkles, Users, FolderKanban, ClipboardCheck, BarChart3, LayoutTemplate, Activity, Settings,
  PanelLeftClose, PanelLeftOpen, LogOut, ChevronDown, Menu, Database, AlertTriangle, FlaskConical,
} from "lucide-react";
import { api } from "@/lib/client/api";
import { cx } from "@/components/shared/ui";
import type { DataMode, SessionUser } from "@/types";

const EMPLOYEE_NAV = [
  { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee/new-request", label: "New Handover", icon: FilePlus2 },
  { href: "/employee/documents", label: "My Documents", icon: FileText },
  { href: "/employee/assistant", label: "AI Assistant", icon: Sparkles, ai: true },
];
const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/admin/documents", label: "All Documents", icon: FileText },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/ai-activity", label: "AI Activity", icon: Activity, ai: true },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

interface Status { mode: DataMode; servicenow: { ok: boolean; message: string }; groq: { configured: boolean } }

export function AppShell({ user, mode, children }: { user: SessionUser; mode: DataMode; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const area = path.startsWith("/admin") ? "admin" : "employee";
  const nav = area === "admin" ? ADMIN_NAV : EMPLOYEE_NAV;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("hai.sidebar") === "1"); } catch { /* per-viewer convenience only */ }
  }, []);
  useEffect(() => {
    api<Status>("/api/servicenow/status").then(setStatus).catch((e) => setStatusError(e.message));
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [path]);
  useEffect(() => {
    const h = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("hai.sidebar", c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  };

  const sidebar = (
    <nav className="flex h-full flex-col bg-navy-900 text-slate-300" aria-label="Main">
      <div className={cx("flex h-14 items-center gap-2 border-b border-white/10 px-4", collapsed && "justify-center px-0")}>
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ai-600 text-[13px] font-bold text-white">H</span>
        {!collapsed && <span className="font-semibold text-white">HandoverAI</span>}
      </div>
      {!collapsed && <p className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{area === "admin" ? "Admin Portal" : "Employee Portal"}</p>}
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {nav.map((n) => {
          const active = path === n.href || path.startsWith(n.href + "/");
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                title={collapsed ? n.label : undefined}
                className={cx("flex h-9 items-center gap-3 rounded-md px-2.5 text-[13.5px] transition-colors", active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white", collapsed && "justify-center")}
              >
                <n.icon className={cx("h-4 w-4 shrink-0", "ai" in n && n.ai && "text-ai-100")} />
                {!collapsed && <span>{n.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      {user.role === "admin" && (
        <div className="border-t border-white/10 p-2">
          <Link href={area === "admin" ? "/employee/dashboard" : "/admin/dashboard"} className={cx("flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] hover:bg-white/5 hover:text-white", collapsed && "justify-center")}>
            <Users className="h-4 w-4" />{!collapsed && (area === "admin" ? "Switch to Employee Portal" : "Switch to Admin Portal")}
          </Link>
        </div>
      )}
      <button onClick={toggle} className="hidden h-10 items-center justify-center border-t border-white/10 text-slate-400 hover:text-white lg:flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>
    </nav>
  );

  const initials = user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const snBad = status && status.mode === "servicenow" && !status.servicenow.ok;

  return (
    <div className="flex min-h-screen">
      <aside className={cx("sticky top-0 hidden h-screen shrink-0 lg:block", collapsed ? "w-16" : "w-60")}>{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-navy-950/40" />
          <aside className="absolute inset-y-0 left-0 w-60" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4">
          <button className="rounded p-1.5 text-muted hover:bg-surface lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <ModeBadge mode={mode} status={status} error={statusError} />
          <div className="ml-auto" ref={menuRef}>
            <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface" aria-haspopup="menu" aria-expanded={menu}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-700">{initials}</span>
              <span className="hidden text-left sm:block">
                <span className="block text-[13px] font-medium leading-tight">{user.fullName}</span>
                <span className="block text-[11.5px] capitalize leading-tight text-muted">{user.role}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted" />
            </button>
            {menu && (
              <div role="menu" className="absolute right-4 mt-1 w-56 rounded-md border border-line bg-white py-1 shadow-lg">
                <p className="border-b border-line px-3 py-2 text-[12px] text-muted">Signed in as <span className="font-medium text-ink">{user.userName}</span></p>
                <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface"><LogOut className="h-4 w-4" />Sign out</button>
              </div>
            )}
          </div>
        </header>
        {snBad && (
          <div role="alert" className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span><strong>ServiceNow connection error:</strong> {status!.servicenow.message} Data cannot be loaded or saved until this is fixed.</span>
          </div>
        )}
        {mode === "demo" && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[12.5px] text-amber-900">
            <strong>Demo Mode</strong> — sample records held in server memory for evaluation. Nothing is saved to ServiceNow, and data resets when the server restarts.
          </div>
        )}
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function ModeBadge({ mode, status, error }: { mode: DataMode; status: Status | null; error: string }) {
  if (mode === "demo") return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-medium text-amber-900"><FlaskConical className="h-3.5 w-3.5" />Demo Mode</span>;
  const ok = status?.servicenow.ok;
  return (
    <span title={status?.servicenow.message || error} className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium", !status ? "bg-slate-100 text-muted" : ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
      <Database className="h-3.5 w-3.5" />
      {!status ? (error ? "Status unavailable" : "Checking ServiceNow…") : ok ? "ServiceNow connected" : "ServiceNow error"}
    </span>
  );
}
