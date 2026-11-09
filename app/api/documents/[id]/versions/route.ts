import { route } from "@/lib/api/handler";
import { loadDocument } from "@/lib/documents/service";
import { documentVersions } from "@/lib/servicenow/documents";
import { employees } from "@/lib/servicenow/employees";
import { id as idSchema } from "@/lib/validation/schemas";

export const GET = route<{ id: string }>("user", async ({ user, params }) => {
  const doc = await loadDocument(user, idSchema.parse(params.id));
  const versions = await documentVersions.all({ where: { documentId: doc.id }, orderBy: "versionNumber", desc: true }, 200);
  const names: Record<string, string> = {};
  await Promise.all([...new Set(versions.map((v) => v.createdBy))].map(async (i) => (names[i] = (await employees.get(i))?.fullName || "Unknown")));
  return { items: versions.map((v) => ({ ...v, createdByName: names[v.createdBy] })) };
});
