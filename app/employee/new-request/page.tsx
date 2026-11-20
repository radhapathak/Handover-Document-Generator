"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, PageSkeleton } from "@/components/shared/ui";
import { RequestForm } from "@/components/forms/request-form";

function Inner() {
  const id = useSearchParams().get("id") || undefined;
  return (
    <>
      <PageHeader
        title={id ? "Edit Module Handover" : "New Module Handover"}
        subtitle="One module handover = one module or process. Describe it in plain English; the AI writes the handover document and flow diagram. Optional fields can be left blank."
        crumbs={[{ label: "Employee Portal", href: "/employee/dashboard" }, { label: id ? "Edit Module Handover" : "New Module Handover" }]}
      />
      <RequestForm key={id || "new"} requestId={id} />
    </>
  );
}

export default function NewRequestPage() {
  return <Suspense fallback={<PageSkeleton />}><Inner /></Suspense>;
}
