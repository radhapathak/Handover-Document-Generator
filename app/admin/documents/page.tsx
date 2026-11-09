import { PageHeader } from "@/components/shared/ui";
import { DocumentList } from "@/components/documents/document-list";

export default function AllDocuments() {
  return (
    <>
      <PageHeader title="All Documents" subtitle="Every documentation request and generated document across the organisation." crumbs={[{ label: "Admin Portal", href: "/admin/dashboard" }, { label: "All Documents" }]} />
      <DocumentList area="admin" />
    </>
  );
}
