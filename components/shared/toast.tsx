"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type Kind = "success" | "error" | "warning" | "info";
interface Toast { id: number; kind: Kind; message: string }
const Ctx = createContext<(kind: Kind, message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Kind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4000);
  }, []);
  const icon = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
  const color = { success: "text-emerald-600", error: "text-red-600", warning: "text-amber-600", info: "text-brand-600" };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => {
          const I = icon[t.kind];
          return (
            <div key={t.id} className="flex items-start gap-3 rounded-lg border border-line bg-white p-3 shadow-lg">
              <I className={`mt-0.5 h-4 w-4 shrink-0 ${color[t.kind]}`} />
              <p className="flex-1 text-sm">{t.message}</p>
              <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const push = useContext(Ctx);
  return {
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
    warning: (m: string) => push("warning", m),
    info: (m: string) => push("info", m),
  };
}
