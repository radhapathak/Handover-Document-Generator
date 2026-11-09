import { z } from "zod";
import { route, parseBody } from "@/lib/api/handler";
import { loadDocument } from "@/lib/documents/service";
import { buildExportInput } from "@/lib/documents/export";
import { buildDocx } from "@/lib/documents/export-docx";
import { buildPdf } from "@/lib/documents/export-pdf";
import { id as idSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit";

export const maxDuration = 60;

const exportInput = z.object({
  format: z.enum(["docx", "pdf"]),
  /** PNG of the Mermaid diagram rendered in the browser (validated: PNG signature, ≤ 4 MB). */
  diagram: z
    .object({
      pngBase64: z.string().max(5_600_000).regex(/^[A-Za-z0-9+/=]+$/),
      width: z.number().int().min(10).max(8000),
      height: z.number().int().min(10).max(12000),
    })
    .optional(),
});

export const POST = route<{ id: string }>("user", async ({ req, user, params }) => {
  const { format, diagram } = await parseBody(req, exportInput);
  const doc = await loadDocument(user, idSchema.parse(params.id));
  if (diagram && Buffer.from(diagram.pngBase64.slice(0, 12), "base64").subarray(0, 4).toString("hex") !== "89504e47") {
    return Response.json({ error: "Diagram image must be a PNG." }, { status: 400 });
  }
  const input = await buildExportInput(doc, diagram);
  const buf = format === "docx" ? await buildDocx(input) : await buildPdf(input);
  const base = doc.title.replace(/[^A-Za-z0-9 _-]/g, "").replace(/\s+/g, "_").slice(0, 80) || "handover";
  audit("document.exported", { user: user.id, documentId: doc.id, format });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
      "Content-Disposition": `attachment; filename="${base}_v${doc.currentVersion}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
});
