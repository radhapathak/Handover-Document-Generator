import { route, parseBody } from "@/lib/api/handler";
import { HttpError } from "@/lib/api/errors";
import { employees, findEmployeeByUserName } from "@/lib/servicenow/employees";
import { employeeInput } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit";

export const GET = route("admin", async () => ({ items: await employees.all({ orderBy: "fullName", desc: false }, 2000) }));

export const POST = route("admin", async ({ req, user }) => {
  const data = await parseBody(req, employeeInput);
  if (await findEmployeeByUserName(data.userName)) throw new HttpError(409, "A profile with this user name already exists.");
  const e = await employees.create(data);
  audit("employee.created", { user: user.id, employeeId: e.id, role: e.role });
  return { item: e };
});
