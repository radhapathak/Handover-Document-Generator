"use client";
import { useEffect, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, Download, RefreshCw, Wand2, Code2, Save, AlertTriangle } from "lucide-react";
import { renderMermaidSvg, svgToPng, validateMermaid } from "@/lib/client/mermaid";
import { downloadBlob } from "@/lib/client/api";
import { Button, EmptyState, Spinner, Textarea } from "@/components/shared/ui";

export function MermaidDiagram({
  code, editable, onRegenerate, onAutoFix, onSave, regenerating, fileName = "workflow",
}: {
  code: string;
  editable?: boolean;
  onRegenerate?: () => void;
  onAutoFix?: (error: string) => void;
  onSave?: (code: string) => Promise<void>;
  regenerating?: boolean;
  fileName?: string;
}) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(code);
  const [draftError, setDraftError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(code);
  }, [code]);
  useEffect(() => {
    let alive = true;
    if (!code) { setSvg(""); setError(""); return; }
    setRendering(true);
    renderMermaidSvg(code)
      .then((s) => alive && (setSvg(s), setError("")))
      .catch((e) => alive && (setSvg(""), setError(e instanceof Error ? e.message : String(e))))
      .finally(() => alive && setRendering(false));
    return () => { alive = false; };
  }, [code]);

  async function downloadPng() {
    const p = await svgToPng(svg);
    downloadBlob(p.blob, `${fileName}.png`);
  }

  async function saveDraft() {
    const err = await validateMermaid(draft);
    if (err) { setDraftError(err); return; }
    setDraftError("");
    setSaving(true);
    try { await onSave?.(draft); setEditing(false); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <Button size="sm" variant="ghost" icon={ZoomOut} aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))} disabled={!svg} />
        <span className="w-12 text-center text-[12px] tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="ghost" icon={ZoomIn} aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.15))} disabled={!svg} />
        <Button size="sm" variant="ghost" icon={Maximize2} onClick={() => setZoom(1)} disabled={!svg}>Reset</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" icon={Download} disabled={!svg} onClick={() => downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${fileName}.svg`)}>SVG</Button>
          <Button size="sm" icon={Download} disabled={!svg} onClick={downloadPng}>PNG</Button>
          {editable && <Button size="sm" icon={Code2} onClick={() => setEditing(!editing)}>{editing ? "Close code" : "Edit code"}</Button>}
          {editable && onRegenerate && <Button size="sm" variant="ai" icon={RefreshCw} loading={regenerating} onClick={onRegenerate}>Regenerate diagram</Button>}
        </div>
      </div>
      {editing && (
        <div className="border-b border-line bg-surface p-3">
          <Textarea aria-label="Mermaid code" rows={10} className="font-mono text-[12.5px]" value={draft} onChange={(e) => setDraft(e.target.value)} />
          {draftError && <p className="mt-1 text-[12.5px] text-red-700">Syntax error: {draftError}</p>}
          <div className="mt-2 flex justify-end"><Button size="sm" variant="primary" icon={Save} loading={saving} onClick={saveDraft}>Validate & save</Button></div>
        </div>
      )}
      <div className="min-h-[320px] overflow-auto bg-[radial-gradient(#e2e7ee_1px,transparent_1px)] [background-size:16px_16px] p-4">
        {rendering ? <div className="flex h-60 items-center justify-center"><Spinner label="Rendering diagram…" /></div>
          : error ? (
            <div role="alert" className="mx-auto max-w-xl rounded-md border border-red-200 bg-white p-4 text-[13px]">
              <p className="flex items-center gap-2 font-medium text-red-700"><AlertTriangle className="h-4 w-4" />The diagram has a syntax error and was not rendered</p>
              <p className="mt-1 font-mono text-[12px] text-muted">{error}</p>
              {editable && onAutoFix && <Button size="sm" variant="ai" className="mt-3" icon={Wand2} loading={regenerating} onClick={() => onAutoFix(error)}>Fix with AI</Button>}
            </div>
          ) : svg ? (
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }} className="inline-block min-w-full transition-transform" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <EmptyState title="No diagram yet" message="Generate a diagram from the module’s routing and workflow configuration." action={editable && onRegenerate ? <Button variant="ai" icon={RefreshCw} loading={regenerating} onClick={onRegenerate}>Generate diagram</Button> : undefined} />
          )}
      </div>
    </div>
  );
}
