"use client";
import { useEffect, useRef, useState } from "react";

type Result = { html: string; mermaid: string; pngBase64: string };

const SAMPLE = JSON.stringify(
  {
    module: "incident",
    categories: [
      { element: "category", label: "Network", value: "network" },
      { element: "subcategory", label: "VPN", value: "vpn", dependent_value: "network" },
      { element: "category", label: "Software", value: "software" },
    ],
    assignmentRules: [
      { name: "VPN to Network L2", order: "100", condition: "category=network^subcategory=vpn", group: "Network L2" },
      { name: "Network default", order: "200", condition: "category=network", group: "Network Service Desk" },
      { name: "Software", order: "300", condition: "category=software", group: "Application Support" },
    ],
    slas: [{ name: "P1 Resolution", duration: "4 Hours", start_condition: "priority=1", stop_condition: "state=6" }],
  },
  null,
  1
);

export default function Home() {
  const [secret, setSecret] = useState("");
  const [module, setModule] = useState("incident");
  const [config, setConfig] = useState(SAMPLE);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const diagramRef = useRef<HTMLDivElement>(null);

  async function generate() {
    setLoading(true);
    setResult(null);
    setError("");
    const start = Date.now();
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-kt-secret": secret },
        body: JSON.stringify({ module, config }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setSeconds(Math.round((Date.now() - start) / 1000));
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!result?.mermaid || !diagramRef.current) return;
    import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
      try {
        const { svg } = await mermaid.render("kt-diagram-" + Date.now(), result.mermaid);
        if (diagramRef.current) diagramRef.current.innerHTML = svg;
      } catch {
        if (diagramRef.current) diagramRef.current.textContent = "Diagram could not be rendered.";
      }
    });
  }, [result]);

  function download() {
    if (!result) return;
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>KT – ${module}</title></head><body>${result.html}${
      result.pngBase64 ? `<h2>Flow Diagram</h2><img src="data:image/png;base64,${result.pngBase64}">` : ""
    }</body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    a.download = `KT-${module}.html`;
    a.click();
  }

  const box: React.CSSProperties = { background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 16 };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 4 }}>Handover Document Generator</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Paste a module&apos;s configuration from ServiceNow and get a knowledge-transfer document and routing diagram.
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="Access code" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} style={{ padding: 8, flex: "1 1 200px" }} />
          <input placeholder="Module (e.g. incident)" value={module} onChange={(e) => setModule(e.target.value)} style={{ padding: 8, flex: "1 1 200px" }} />
        </div>
        <textarea rows={12} value={config} onChange={(e) => setConfig(e.target.value)}
          style={{ width: "100%", marginTop: 8, fontFamily: "monospace", fontSize: 13, boxSizing: "border-box" }} />
        <button onClick={generate} disabled={loading || !secret}
          style={{ marginTop: 8, padding: "10px 18px", fontSize: 15, cursor: "pointer" }}>
          {loading ? "Generating…" : "Generate KT Document"}
        </button>
        {error && <p style={{ color: "#b00020" }}>{error}</p>}
      </div>

      {result && (
        <>
          <div style={{ ...box, background: "#eef7ee" }}>
            <b>Done in {seconds} seconds</b> (manual: about 2 days){" "}
            <button onClick={download} style={{ marginLeft: 12 }}>Download HTML</button>
          </div>
          <div style={box}>
            <h2 style={{ marginTop: 0 }}>Routing Flow</h2>
            <div ref={diagramRef} style={{ overflowX: "auto" }} />
          </div>
          <div style={{ ...box, overflowX: "auto" }} dangerouslySetInnerHTML={{ __html: result.html }} />
        </>
      )}
    </main>
  );
}
