import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { Button, PageHeader } from "@/components/shared/ui";
import { DocumentList } from "@/components/documents/document-list";

export default function MyDocuments() {
  return (
    <>
      <PageHeader title="My Documents" subtitle="Your documentation requests, generated documents and approval status." crumbs={[{ label: "Employee Portal", href: "/employee/dashboard" }, { label: "My Documents" }]} actions={<Link href="/employee/new-request"><Button variant="primary" icon={FilePlus2}>Create New Handover</Button></Link>} />
      <DocumentList area="employee" />
    </>
  );
}
