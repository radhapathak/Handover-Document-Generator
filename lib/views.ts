import { employees } from "@/lib/servicenow/employees";
import { projects } from "@/lib/servicenow/projects";
import { documentRequests, generatedDocuments } from "@/lib/servicenow/documents";
import type { DocumentRequest, GeneratedDocument, SessionUser } from "@/types";

/** Lookups used to show names instead of sys_ids in lists. */
export async function nameMaps() {
  const [people, projs] = await Promise.all([employees.all({}, 1000), projects.all({}, 1000)]);
  return {
    person: new Map(people.map((p) => [p.id, p.fullName])),
    project: new Map(projs.map((p) => [p.id, p.name])),
    people,
    projects: projs,
  };
}

export async function visibleDocuments(user: SessionUser): Promise<GeneratedDocument[]> {
  return user.role === "admin" ? generatedDocuments.all({}, 2000) : generatedDocuments.all({ where: { authorId: user.id } }, 1000);
}

export async function visibleRequests(user: SessionUser): Promise<DocumentRequest[]> {
  return user.role === "admin" ? documentRequests.all({}, 2000) : documentRequests.all({ where: { requestedBy: user.id } }, 1000);
}

/** Strip heavy fields for list views. */
export function docSummary(d: GeneratedDocument, names: Awaited<ReturnType<typeof nameMaps>>) {
  const sections = d.content?.sections || [];
  return {
    id: d.id,
    requestId: d.requestId,
    title: d.title,
    state: d.state,
    currentVersion: d.currentVersion,
    projectId: d.projectId,
    projectName: names.project.get(d.projectId) || "",
    authorId: d.authorId,
    authorName: names.person.get(d.authorId) || "",
    estimatedHoursSaved: d.estimatedHoursSaved,
    generationSeconds: d.generationSeconds,
    issues: sections.filter((s) => s.status !== "ok").length,
    submittedAt: d.submittedAt,
    approvedAt: d.approvedAt,
    publishedAt: d.publishedAt,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}
