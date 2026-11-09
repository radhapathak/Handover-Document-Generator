import { repository } from "@/lib/servicenow/repository";
import type { DocumentTemplate } from "@/types";

export const templates = repository<DocumentTemplate>("document_template");
