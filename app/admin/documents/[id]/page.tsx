import { pageUser } from "@/lib/auth/server-page";
import { DocumentWorkspace } from "@/components/documents/document-workspace";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await pageUser(true);
  if ("error" in r) return null;
  return <DocumentWorkspace id={id} area="admin" user={{ id: r.user.id, role: r.user.role }} />;
}
