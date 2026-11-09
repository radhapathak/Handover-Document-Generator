import type { DocSection } from "@/types";

export interface ExportInput {
  title: string;
  projectName: string;
  projectCode: string;
  applicationName: string;
  moduleName: string;
  moduleOwner: string;
  department: string;
  documentType: string;
  requestNumber: string;
  authorName: string;
  approverName: string;
  stateLabel: string;
  version: number;
  createdAt: string;
  approvedAt: string;
  sections: DocSection[];
  revisions: { version: string; date: string; author: string; summary: string }[];
  diagram?: { pngBase64: string; width: number; height: number };
  workflowSectionKey: string;
}

export const fmtDate = (iso: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : "—");
