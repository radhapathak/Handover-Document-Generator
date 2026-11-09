import { repository } from "@/lib/servicenow/repository";
import type { AiGenerationLog } from "@/types";

export const aiLogs = repository<AiGenerationLog>("ai_generation_log");
