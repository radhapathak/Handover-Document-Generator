import { route } from "@/lib/api/handler";
import { HttpError } from "@/lib/api/errors";
import { assertCanAccessRequest } from "@/lib/auth/guard";
import { documentRequests, requestAttachments } from "@/lib/servicenow/documents";
import { extractText, validateUpload } from "@/lib/documents/uploads";
import { id as idSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit";

const MAX_REFERENCE = 100000;

export const GET = route<{ id: string }>("user", async ({ user, params }) => {
  const r = await documentRequests.getOrThrow(idSchema.parse(params.id));
  assertCanAccessRequest(user, r);
  return { items: await requestAttachments.list(r.id) };
});

/** Upload a reference document: validated, stored via the Attachment API, text extracted as AI context. */
export const POST = route<{ id: string }>("user", async ({ req, user, params }) => {
  const r = await documentRequests.getOrThrow(idSchema.parse(params.id));
  assertCanAccessRequest(user, r);
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 12 * 1024 * 1024) throw new HttpError(413, "Upload too large.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file provided.");
  const data = Buffer.from(await file.arrayBuffer());
  const v = validateUpload(file.name, data);

  let text = "";
  try {
    text = (await extractText(v.ext, data)).replace(/\u0000/g, "").trim();
  } catch {
    throw new HttpError(422, "Could not read text from this file. Is it password-protected or scanned?");
  }
  const meta = await requestAttachments.upload(r.id, v.safeName, v.mime, data);
  const combined = `${r.referenceText ? r.referenceText + "\n\n" : ""}--- ${v.safeName} ---\n${text}`.slice(0, MAX_REFERENCE);
  await documentRequests.update(r.id, { referenceText: combined });
  audit("request.attachment", { user: user.id, requestId: r.id, file: v.safeName, bytes: data.length });
  return { item: meta, extractedChars: text.length, truncated: combined.length >= MAX_REFERENCE };
});
