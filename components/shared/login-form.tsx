"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button, Field, Input } from "@/components/shared/ui";
import type { DataMode } from "@/types";

export function LoginForm({ mode, disabled }: { mode: DataMode; disabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api<{ user: { role: string } }>("/api/auth/login", { body: { username, password } });
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.push(safeNext && (r.user.role === "admin" || !safeNext.startsWith("/admin")) ? safeNext : r.user.role === "admin" ? "/admin/dashboard" : "/employee/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Field label={mode === "servicenow" ? "ServiceNow user name" : "User name"} htmlFor="username">
        <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={disabled} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={disabled} />
      </Field>
      {error && <p role="alert" className="rounded-md bg-red-50 p-2.5 text-[13px] text-red-700">{error}</p>}
      <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={disabled} icon={LogIn}>Sign in</Button>
    </form>
  );
}
