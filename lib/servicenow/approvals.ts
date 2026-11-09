import { repository } from "@/lib/servicenow/repository";
import type { DocumentApproval } from "@/types";

export const documentApprovals = repository<DocumentApproval>("document_approval");
