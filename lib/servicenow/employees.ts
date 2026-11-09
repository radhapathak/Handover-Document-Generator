import { repository } from "@/lib/servicenow/repository";
import type { EmployeeProfile } from "@/types";

export const employees = repository<EmployeeProfile>("employee_profile");

export async function findEmployeeByUserName(userName: string): Promise<EmployeeProfile | null> {
  const { items } = await employees.list({ where: { userName }, limit: 1 });
  return items[0] || null;
}
