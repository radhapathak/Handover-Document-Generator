import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, LevelFormat, Packer, PageBreak, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType,
} from "docx";
import { htmlToBlocks, type Block, type Run } from "@/lib/documents/blocks";
import { META_SECTIONS } from "@/lib/documents/sections";
import { fmtDate, type ExportInput } from "@/lib/documents/export-types";

const NAVY = "0B1F3A";
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "C9D1DC" };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

const textRuns = (rs: Run[], extra: { bold?: boolean; color?: string; size?: number } = {}) =>
  rs.flatMap((r) =>
    r.text.split("\n").map(
      (part, i) =>
        new TextRun({
          text: part,
          break: i > 0 ? 1 : undefined,
          bold: r.bold || extra.bold,
          italics: r.italic,
          underline: r.underline ? {} : undefined,
          font: r.code ? "Consolas" : undefined,
          color: extra.color,
          size: extra.size,
        })
    )
  );

function kvTable(rows: [string, string][]) {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [3000, 6000],
    rows: rows.map(
      ([k, v]) =>
        new TableRow({
          children: [
            new TableCell({ borders: CELL_BORDERS, width: { size: 3000, type: WidthType.DXA }, shading: { fill: "EEF2F7", type: ShadingType.CLEAR, color: "auto" }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })] }),
            new TableCell({ borders: CELL_BORDERS, width: { size: 6000, type: WidthType.DXA }, children: [new Paragraph(v || "—")] }),
          ],
        })
    ),
  });
}

function gridTable(rows: { header: boolean; cells: string[] }[]) {
  const cols = Math.max(...rows.map((r) => r.cells.length), 1);
  const w = Math.floor(9000 / cols);
  return new Table({
    width: { size: w * cols, type: WidthType.DXA },
    columnWidths: Array(cols).fill(w),
    rows: rows.map(
      (r, ri) =>
        new TableRow({
          tableHeader: r.header && ri === 0,
          children: Array.from({ length: cols }, (_, ci) =>
            new TableCell({
              borders: CELL_BORDERS,
              width: { size: w, type: WidthType.DXA },
              shading: r.header ? { fill: "EEF2F7", type: ShadingType.CLEAR, color: "auto" } : undefined,
              children: (r.cells[ci] || "").split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, bold: r.header, size: 18 })] })),
            })
          ),
        })
    ),
  });
}

function blocksToDocx(blocks: Block[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push(new Paragraph({ heading: b.level === 3 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: textRuns(b.runs) }));
        break;
      case "paragraph":
        out.push(new Paragraph({ spacing: { after: 120 }, children: textRuns(b.runs) }));
        break;
      case "quote":
        out.push(new Paragraph({ indent: { left: 400 }, children: textRuns(b.runs, { color: "555555" }) }));
        break;
      case "code":
        b.text.split("\n").forEach((l) => out.push(new Paragraph({ children: [new TextRun({ text: l, font: "Consolas", size: 18 })] })));
        break;
      case "list":
        b.items.forEach((it) =>
          out.push(new Paragraph({ numbering: { reference: b.ordered ? "numbers" : "bullets", level: Math.min(it.level, 2) }, children: textRuns(it.runs) }))
        );
        break;
      case "table":
        out.push(gridTable(b.rows), new Paragraph(""));
        break;
    }
  }
  return out;
}

export async function buildDocx(d: ExportInput): Promise<Buffer> {
  const cover = [
    new Paragraph({ spacing: { before: 2400 }, children: [new TextRun({ text: "HANDOVER DOCUMENT", bold: true, color: "5B4BDB", size: 24 })] }),
    new Paragraph({ spacing: { before: 200, after: 200 }, children: [new TextRun({ text: d.title, bold: true, size: 52, color: NAVY })] }),
    new Paragraph({ children: [new TextRun({ text: `${d.projectName} · ${d.moduleName}`, size: 28, color: "444444" })] }),
    new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: `Version ${d.version}   |   Status: ${d.stateLabel}   |   ${fmtDate(new Date().toISOString())}`, size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: `Prepared by ${d.authorName}${d.approverName ? ` · Approved by ${d.approverName}` : ""}`, size: 22 })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const info = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: `2. ${META_SECTIONS[1].title}` }),
    kvTable([
      ["Document Title", d.title],
      ["Document Type", d.documentType],
      ["Request Number", d.requestNumber],
      ["Project", `${d.projectName}${d.projectCode ? ` (${d.projectCode})` : ""}`],
      ["Application", d.applicationName],
      ["Module", d.moduleName],
      ["Module Owner", d.moduleOwner],
      ["Business Department", d.department],
      ["Author", d.authorName],
      ["Approver", d.approverName],
      ["Status", d.stateLabel],
      ["Version", String(d.version)],
      ["Created", fmtDate(d.createdAt)],
      ["Approved", fmtDate(d.approvedAt)],
    ]),
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: `3. ${META_SECTIONS[2].title}`, spacing: { before: 400 } }),
    gridTable([{ header: true, cells: ["Version", "Date", "Author", "Summary"] }, ...d.revisions.map((r) => ({ header: false, cells: [r.version, r.date, r.author, r.summary] }))]),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Table of Contents" }),
    new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const body: (Paragraph | Table)[] = [];
  d.sections.forEach((s, i) => {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: `${i + META_SECTIONS.length + 1}. ${s.title}`, spacing: { before: 360 } }));
    if (s.key === d.workflowSectionKey && d.diagram) {
      const maxW = 600;
      const scale = Math.min(1, maxW / d.diagram.width);
      body.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: "png",
              data: Buffer.from(d.diagram.pngBase64, "base64"),
              transformation: { width: Math.round(d.diagram.width * scale), height: Math.round(d.diagram.height * scale) },
              altText: { title: "Process flow diagram", description: "Workflow and routing flow", name: "flow" },
            }),
          ],
        }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Figure 1 – Process flow diagram", italics: true, size: 18 })] })
      );
    }
    body.push(...blocksToDocx(htmlToBlocks(s.html)));
  });

  const doc = new Document({
    creator: "HandoverAI",
    title: d.title,
    features: { updateFields: true }, // Word refreshes the table of contents and page numbers on open
    styles: {
      default: { document: { run: { font: "Calibri", size: 21 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: "1F4E8C" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [0, 1, 2].map((l) => ({ level: l, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (l + 1), hanging: 360 } } } })) },
        { reference: "numbers", levels: [0, 1, 2].map((l) => ({ level: l, format: LevelFormat.DECIMAL, text: `%${l + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (l + 1), hanging: 360 } } } })) },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${d.title} · ${d.stateLabel}`, size: 16, color: "777777" })] })] }) },
        footers: {
          default: new Footer({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: "777777" })] })],
          }),
        },
        children: [...cover, ...info, ...body],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
