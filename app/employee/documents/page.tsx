"use client";

import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { Button, PageHeader } from "@/components/shared/ui";
import { DocumentList } from "@/components/documents/document-list";

export default function MyDocuments() {
  return (
    <>
      <PageHeader title="My Documents" subtitle="Your module handovers: the generated documents and their approval status." crumbs={[{ label: "Employee Portal", href: "/employee/dashboard" }, { label: "My Documents" }]} actions={<Link href="/employee/new-request"><Button variant="primary" icon={FilePlus2}>New Module Handover</Button></Link>} />
      <DocumentList area="employee" />
    </>
  );
}
