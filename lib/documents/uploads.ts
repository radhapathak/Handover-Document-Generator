import { HttpError } from "@/lib/api/errors";
import { config } from "@/lib/config";

export const ALLOWED_UPLOADS: Record<string, { mime: string; label: string }> = {
  ".txt": { mime: "text/plain", label: "Text" },
  ".md": { mime: "text/markdown", label: "Markdown" },
  ".csv": { mime: "text/csv", label: "CSV" },
  ".json": { mime: "application/json", label: "JSON" },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word" },
  ".pdf": { mime: "application/pdf", label: "PDF" },
};

function ext(name: string) {
  const m = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? m[0] : "";
}

/** Validates name, size and magic bytes (the browser-supplied MIME type is not trusted). */
export function validateUpload(fileName: string, data: Buffer) {
  const e = ext(fileName);
  const spec = ALLOWED_UPLOADS[e];
  if (!spec) throw new HttpError(415, `File type not allowed. Allowed: ${Object.keys(ALLOWED_UPLOADS).join(", ")}`);
  if (data.length === 0) throw new HttpError(400, "The file is empty.");
  if (data.length > config.limits.maxUploadBytes) {
    throw new HttpError(413, `File is larger than ${Math.round(config.limits.maxUploadBytes / 1024 / 1024)} MB.`);
  }
  if (e === ".pdf" && data.subarray(0, 5).toString("latin1") !== "%PDF-") throw new HttpError(415, "File is not a valid PDF.");
  if (e === ".docx" && !(data[0] === 0x50 && data[1] === 0x4b)) throw new HttpError(415, "File is not a valid Word document.");
  if ([".txt", ".md", ".csv", ".json"].includes(e) && data.subarray(0, 8000).includes(0)) {
    throw new HttpError(415, "Text file contains binary data.");
  }
  const safeName = fileName.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 120);
  return { ext: e, mime: spec.mime, safeName };
}

export async function extractText(e: string, data: Buffer): Promise<string> {
  if (e === ".docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: data })).value;
  }
  if (e === ".pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await pdfText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  return data.toString("utf8");
}
