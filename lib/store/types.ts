import type { RawRecord } from "@/lib/servicenow/schema";

export interface ListOptions {
  /** Raw column → exact value. */
  where?: Record<string, string>;
  /** Raw column → one of these values. */
  whereIn?: Record<string, string[]>;
  orderBy?: string;
  desc?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListResult {
  records: RawRecord[];
  total: number;
}

export interface AttachmentMeta {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

/** Storage backend: ServiceNow Table/Attachment API, or the explicitly labelled in-memory demo store. */
export interface TableStore {
  readonly kind: "servicenow" | "demo";
  list(table: string, opts?: ListOptions): Promise<ListResult>;
  get(table: string, sysId: string): Promise<RawRecord | null>;
  create(table: string, values: RawRecord): Promise<RawRecord>;
  update(table: string, sysId: string, values: RawRecord): Promise<RawRecord>;
  remove(table: string, sysId: string): Promise<void>;
  uploadAttachment(table: string, sysId: string, fileName: string, contentType: string, data: Buffer): Promise<AttachmentMeta>;
  listAttachments(table: string, sysId: string): Promise<AttachmentMeta[]>;
}

export class IntegrationError extends Error {
  constructor(
    message: string,
    public status = 502,
    public detail?: string
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

/** Reject values that could alter a ServiceNow encoded query. */
export function safeQueryValue(v: string): string {
  if (/[\^\n\r]/.test(v)) throw new IntegrationError("Invalid characters in query value", 400);
  return v;
}
