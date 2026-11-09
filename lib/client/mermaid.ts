"use client";
/* Browser-side Mermaid helpers: strict security, syntax validation, SVG→PNG. */
type MermaidApi = typeof import("mermaid").default;
let mm: Promise<MermaidApi> | null = null;
let counter = 0;

function load(): Promise<MermaidApi> {
  if (!mm) {
    mm = import("mermaid").then(({ default: m }) => {
      m.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", flowchart: { htmlLabels: false, curve: "basis" }, themeVariables: { primaryColor: "#e3edfb", primaryBorderColor: "#1f4e8c", primaryTextColor: "#0b1f3a", lineColor: "#5d6b7e", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "14px" } });
      return m;
    });
  }
  return mm;
}

export async function validateMermaid(code: string): Promise<string | null> {
  const m = await load();
  try {
    await m.parse(code);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message.split("\n").slice(0, 4).join(" ") : String(e);
  }
}

export async function renderMermaidSvg(code: string): Promise<string> {
  const m = await load();
  const err = await validateMermaid(code);
  if (err) throw new Error(err);
  const { svg } = await m.render(`hai-mmd-${++counter}`, code);
  return svg;
}

/** Normalises the SVG for rasterising: explicit pixel width/height and a viewBox. */
function prepareSvg(svg: string): { xml: string; w: number; h: number } {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const el = doc.documentElement;
  let w = 0, h = 0;
  const vb = el.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    [, , w, h] = vb;
  } else {
    // No viewBox: measure by mounting off-screen.
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden";
    host.innerHTML = svg;
    document.body.appendChild(host);
    const live = host.querySelector("svg") as SVGSVGElement;
    const box = live.getBBox();
    host.remove();
    w = Math.ceil(box.x + box.width + 8);
    h = Math.ceil(box.y + box.height + 8);
    el.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  el.setAttribute("width", String(w));
  el.setAttribute("height", String(h));
  el.removeAttribute("style");
  if (!el.getAttribute("xmlns")) el.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { xml: new XMLSerializer().serializeToString(el), w, h };
}

/** Renders SVG to a PNG (2x for print quality). htmlLabels are off so the canvas is not tainted. */
export async function svgToPng(svg: string, scale = 2): Promise<{ base64: string; width: number; height: number; blob: Blob }> {
  const { xml, w, h } = prepareSvg(svg);
  // A data: URL (not blob:) keeps the canvas untainted in Chromium so it can be exported.
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("Could not rasterise diagram")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("PNG export failed"))), "image/png"));
    const base64 = canvas.toDataURL("image/png").split(",")[1];
    return { base64, width: Math.round(w), height: Math.round(h), blob };
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}
