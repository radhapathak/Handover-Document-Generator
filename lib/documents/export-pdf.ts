import { createRequire } from "module";
import { htmlToBlocks, type Block, type Run } from "@/lib/documents/blocks";
import { META_SECTIONS } from "@/lib/documents/sections";
import { fmtDate, type ExportInput } from "@/lib/documents/export-types";

/* pdfmake is a CommonJS server module (listed in serverExternalPackages). */
type PdfNode = Record<string, unknown> | string;
interface PdfMake {
  setFonts(f: unknown): void;
  setUrlAccessPolicy(cb: (url: string) => boolean): void;
  setLocalAccessPolicy(cb: (p: string) => boolean): void;
  createPdf(def: unknown): { getBuffer(): Promise<Buffer> };
}

let pdfmake: PdfMake | null = null;
function getPdfMake(): PdfMake {
  if (!pdfmake) {
    const req = createRequire(import.meta.url);
    pdfmake = req("pdfmake") as PdfMake;
    // Built-in PDF fonts: nothing is read from disk or the network.
    pdfmake.setFonts({ Helvetica: { normal: "Helvetica", bold: "Helvetica-Bold", italics: "Helvetica-Oblique", bolditalics: "Helvetica-BoldOblique" }, Courier: { normal: "Courier", bold: "Courier-Bold", italics: "Courier-Oblique", bolditalics: "Courier-BoldOblique" } });
    pdfmake.setUrlAccessPolicy(() => false);
    // Only the 14 standard PDF font names may be "loaded"; any other local path is refused.
    const STANDARD = new Set(["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique", "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"]);
    pdfmake.setLocalAccessPolicy((p) => STANDARD.has(p));
  }
  return pdfmake;
}

const NAVY = "#0B1F3A";

/** Standard PDF fonts only cover Latin-1; replace common typographic characters so nothing renders as blanks. */
const latin = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[→➔]/g, "->").replace(/[•·]/g, "-").replace(/[^\x00-\xFF]/g, "");

const runs = (rs: Run[]): PdfNode[] => rs.map((r) => ({ text: latin(r.text), bold: r.bold, italics: r.italic, decoration: r.underline ? "underline" : undefined, font: r.code ? "Courier" : undefined }));

function grid(rows: { header: boolean; cells: string[] }[]): PdfNode {
  const cols = Math.max(...rows.map((r) => r.cells.length), 1);
  return {
    table: {
      headerRows: rows[0]?.header ? 1 : 0,
      widths: Array(cols).fill("*"),
      body: rows.map((r) => Array.from({ length: cols }, (_, i) => ({ text: latin(r.cells[i] || ""), bold: r.header, fillColor: r.header ? "#EEF2F7" : undefined, fontSize: 8.5 }))),
    },
    layout: { hLineColor: () => "#C9D1DC", vLineColor: () => "#C9D1DC", hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingTop: () => 3, paddingBottom: () => 3 },
    margin: [0, 4, 0, 10],
  };
}

function blocksToPdf(blocks: Block[]): PdfNode[] {
  const out: PdfNode[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push({ text: runs(b.runs), style: b.level === 3 ? "h2" : "h3" });
        break;
      case "paragraph":
        out.push({ text: runs(b.runs), margin: [0, 0, 0, 6] });
        break;
      case "quote":
        out.push({ text: runs(b.runs), margin: [16, 0, 0, 6], color: "#555555" });
        break;
      case "code":
        out.push({ text: latin(b.text), font: "Courier", fontSize: 8, margin: [0, 0, 0, 6], background: "#F3F4F6" });
        break;
      case "list": {
        const items = b.items.map((it) => ({ text: runs(it.runs), margin: [it.level * 14, 0, 0, 2] }));
        out.push(b.ordered ? { ol: items, margin: [0, 0, 0, 6] } : { ul: items, margin: [0, 0, 0, 6] });
        break;
      }
      case "table":
        out.push(grid(b.rows));
        break;
    }
  }
  return out;
}

export async function buildPdf(d: ExportInput): Promise<Buffer> {
  const L = latin;
  const kv = (rows: [string, string][]) =>
    grid(rows.map(([k, v]) => ({ header: false, cells: [k, v || "-"] })));

  const body: PdfNode[] = [];
  d.sections.forEach((s, i) => {
    body.push({ text: L(`${i + META_SECTIONS.length + 1}. ${s.title}`), style: "h1", tocItem: true, pageBreak: i === 0 ? undefined : undefined });
    if (s.key === d.workflowSectionKey && d.diagram) {
      body.push({ image: `data:image/png;base64,${d.diagram.pngBase64}`, fit: [500, 600], alignment: "center", margin: [0, 6, 0, 4] });
      body.push({ text: "Figure 1 - Process flow diagram", italics: true, fontSize: 8, alignment: "center", margin: [0, 0, 0, 10] });
    }
    body.push(...blocksToPdf(htmlToBlocks(s.html)));
  });

  const def = {
    pageSize: "A4",
    pageMargins: [50, 60, 50, 60],
    defaultStyle: { font: "Helvetica", fontSize: 9.5, lineHeight: 1.25 },
    info: { title: L(d.title), creator: "HandoverAI" },
    header: (page: number) => (page === 1 ? "" : { text: L(`${d.title} - ${d.stateLabel}`), alignment: "right", fontSize: 7.5, color: "#777777", margin: [50, 25, 50, 0] }),
    footer: (page: number, pages: number) => ({ text: `Page ${page} of ${pages}`, alignment: "center", fontSize: 7.5, color: "#777777", margin: [0, 25, 0, 0] }),
    styles: {
      h1: { fontSize: 15, bold: true, color: NAVY, margin: [0, 14, 0, 8] },
      h2: { fontSize: 11.5, bold: true, color: "#1F4E8C", margin: [0, 8, 0, 4] },
      h3: { fontSize: 10, bold: true, margin: [0, 6, 0, 3] },
    },
    content: [
      { text: "HANDOVER DOCUMENT", color: "#5B4BDB", bold: true, fontSize: 11, margin: [0, 180, 0, 8] },
      { text: L(d.title), fontSize: 26, bold: true, color: NAVY },
      { text: L(`${d.projectName} - ${d.moduleName}`), fontSize: 13, color: "#444444", margin: [0, 8, 0, 40] },
      { text: L(`Version ${d.version}   |   Status: ${d.stateLabel}   |   ${fmtDate(new Date().toISOString())}`), fontSize: 10 },
      { text: L(`Prepared by ${d.authorName}${d.approverName ? ` - Approved by ${d.approverName}` : ""}`), fontSize: 10, pageBreak: "after" },

      { text: `2. ${META_SECTIONS[1].title}`, style: "h1", tocItem: true },
      kv([
        ["Document Title", L(d.title)],
        ["Document Type", L(d.documentType)],
        ["Request Number", d.requestNumber],
        ["Project", L(`${d.projectName}${d.projectCode ? ` (${d.projectCode})` : ""}`)],
        ["Application", L(d.applicationName)],
        ["Module", L(d.moduleName)],
        ["Module Owner", L(d.moduleOwner)],
        ["Business Department", L(d.department)],
        ["Author", L(d.authorName)],
        ["Approver", L(d.approverName)],
        ["Status", d.stateLabel],
        ["Version", String(d.version)],
        ["Created", fmtDate(d.createdAt)],
        ["Approved", fmtDate(d.approvedAt)],
      ]),
      { text: `3. ${META_SECTIONS[2].title}`, style: "h1", tocItem: true },
      grid([{ header: true, cells: ["Version", "Date", "Author", "Summary"] }, ...d.revisions.map((r) => ({ header: false, cells: [r.version, r.date, L(r.author), L(r.summary)] }))]),
      { text: "", pageBreak: "after" },
      { toc: { title: { text: "Table of Contents", style: "h1" }, numberStyle: { fontSize: 9 }, textStyle: { fontSize: 9.5 } } },
      { text: "", pageBreak: "after" },
      ...body,
    ],
  };
  return getPdfMake().createPdf(def).getBuffer();
}
