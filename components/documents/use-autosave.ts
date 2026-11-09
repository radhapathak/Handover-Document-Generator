"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { DocContent } from "@/types";

export type SaveState = "saved" | "dirty" | "saving" | "error";

/**
 * Debounced, strictly sequential auto-save to the server (ServiceNow).
 * - never sends overlapping saves; a newer edit queues one follow-up save
 * - retries failures with backoff and keeps the edits in memory
 * - warns before leaving the page while edits are unsaved
 */
export function useAutosave(documentId: string, enabled: boolean, delayMs = 2500) {
  const [state, setState] = useState<SaveState>("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const pending = useRef<DocContent | null>(null);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (inflight.current || !pending.current) return !pending.current;
    const content = pending.current;
    pending.current = null;
    inflight.current = true;
    setState("saving");
    try {
      await api(`/api/documents/${documentId}`, { method: "PATCH", body: { content } });
      retries.current = 0;
      setLastSaved(new Date());
      setError("");
      inflight.current = false;
      if (pending.current) return flush();
      setState("saved");
      return true;
    } catch (e) {
      inflight.current = false;
      if (!pending.current) pending.current = content; // keep the unsaved edits
      setState("error");
      setError(e instanceof Error ? e.message : String(e));
      const status = (e as { status?: number }).status;
      if (status !== 409 && status !== 400 && retries.current < 5) {
        const wait = 2000 * 2 ** retries.current++;
        timer.current = setTimeout(() => void flush(), wait);
      }
      return false;
    }
  }, [documentId]);

  const queue = useCallback((content: DocContent) => {
    if (!enabled) return;
    pending.current = content;
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delayMs);
  }, [enabled, delayMs, flush]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (pending.current || inflight.current) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => { window.removeEventListener("beforeunload", h); if (timer.current) clearTimeout(timer.current); };
  }, []);

  return { state, lastSaved, error, queue, flush };
}
