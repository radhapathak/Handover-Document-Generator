import { repository } from "@/lib/servicenow/repository";
import { getStore } from "@/lib/store";
import type { DocumentRequest, DocumentVersion, GeneratedDocument } from "@/types";

export const documentRequests = repository<DocumentRequest>("document_request");
export const generatedDocuments = repository<GeneratedDocument>("generated_document");
export const documentVersions = repository<DocumentVersion>("document_version");

/** Attachments live on the document request record (ServiceNow Attachment API). */
export const requestAttachments = {
  upload: (requestId: string, fileName: string, contentType: string, data: Buffer) =>
    getStore().uploadAttachment(documentRequests.table(), requestId, fileName, contentType, data),
  list: (requestId: string) => getStore().listAttachments(documentRequests.table(), requestId),
};
