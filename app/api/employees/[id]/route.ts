import { route, parseBody } from "@/lib/api/handler";
import { HttpError } from "@/lib/api/errors";
import { employees } from "@/lib/servicenow/employees";
import { invalidateProfileCache } from "@/lib/auth/guard";
import { employeeInput, id as idSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit";

export const PATCH = route<{ id: string }>("admin", async ({ req, user, params }) => {
  const id = idSchema.parse(params.id);
  const data = await parseBody(req, employeeInput.partial().omit({ userName: true }));
  if (id === user.id && (data.role === "employee" || data.active === false)) {
    throw new HttpError(400, "You cannot remove your own admin access.");
  }
  const e = await employees.update(id, data);
  invalidateProfileCache(id);
  audit("employee.updated", { user: user.id, employeeId: id, changes: Object.keys(data) });
  return { item: e };
});
