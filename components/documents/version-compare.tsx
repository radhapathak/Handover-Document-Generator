"use client";
import { useMemo, useState } from "react";
import { diffWords } from "diff";
import { useApi, fmtDateTime } from "@/lib/client/api";
import { Badge, ErrorState, Modal, Select, Spinner } from "@/components/shared/ui";
import type { DocumentVersion } from "@/types";

const text = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent || "").replace(/\s+/g, " ").trim();
};

export function VersionCompare({ documentId, open, onClose }: { documentId: string; open: boolean; onClose: () => void }) {
  const { data, error, loading, reload } = useApi<{ items: (DocumentVersion & { createdByName: string })[] }>(open ? `/api/documents/${documentId}/versions` : null);
  const versions = data?.items || [];
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const va = versions.find((v) => v.id === a) || versions[1];
  const vb = versions.find((v) => v.id === b) || versions[0];

  const diffs = useMemo(() => {
    if (!va || !vb) return [];
    const keys = [...new Set([...(va.content?.sections || []).map((s) => s.key), ...(vb.content?.sections || []).map((s) => s.key)])];
    return keys.map((k) => {
      const sa = va.content?.sections.find((s) => s.key === k);
      const sb = vb.content?.sections.find((s) => s.key === k);
      const parts = diffWords(text(sa?.html || ""), text(sb?.html || ""));
      return { key: k, title: sb?.title || sa?.title || k, parts, changed: parts.some((p) => p.added || p.removed) };
    });
  }, [va, vb]);
  const mermaidChanged = va && vb && va.mermaid !== vb.mermaid;

  return (
    <Modal open={open} onClose={onClose} title="Compare document versions" wide>
      {loading ? <Spinner label="Loading versions…" /> : error ? <ErrorState message={error} onRetry={reload} /> : versions.length < 2 ? (
        <p className="text-sm text-muted">Only one version exists. Versions are created on AI generation, “Save version”, and submission.</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            {[["Older version", va, setA], ["Newer version", vb, setB]].map(([label, v, set]) => (
              <label key={label as string} className="text-[13px] font-medium">
                {label as string}
                <Select className="mt-1" value={(v as DocumentVersion)?.id || ""} onChange={(e) => (set as (s: string) => void)(e.target.value)}>
                  {versions.map((x) => <option key={x.id} value={x.id}>v{x.versionNumber} · {x.changeSummary} · {x.createdByName} · {fmtDateTime(x.createdAt)}</option>)}
                </Select>
              </label>
            ))}
          </div>
          <p className="mb-3 text-[12.5px] text-muted">
            <span className="rounded bg-emerald-100 px-1 text-emerald-800">Added</span> <span className="ml-2 rounded bg-red-100 px-1 text-red-800 line-through">Removed</span>
            {mermaidChanged && <Badge tone="purple" className="ml-3">Workflow diagram changed</Badge>}
          </p>
          <div className="space-y-3">
            {diffs.filter((d) => d.changed).length === 0 && <p className="text-sm text-muted">No text differences between these versions.</p>}
            {diffs.filter((d) => d.changed).map((d) => (
              <div key={d.key} className="rounded-md border border-line p-3">
                <p className="mb-1 text-[13px] font-semibold text-navy-900">{d.title}</p>
                <p className="text-[13px] leading-relaxed">
                  {d.parts.map((p, i) => <span key={i} className={p.added ? "rounded bg-emerald-100 text-emerald-900" : p.removed ? "rounded bg-red-100 text-red-800 line-through" : ""}>{p.value}</span>)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
