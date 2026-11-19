import { repository } from "@/lib/servicenow/repository";
import type { KtPlan, KtTask } from "@/types";

export const ktPlans = repository<KtPlan>("kt_plan");
export const ktTasks = repository<KtTask>("kt_task");
