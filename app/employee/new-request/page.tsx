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
        title={id ? "Edit Handover Request" : "Create New Handover"}
        subtitle="Describe the module in plain English. Optional fields can be left blank."
        crumbs={[{ label: "Employee Portal", href: "/employee/dashboard" }, { label: id ? "Edit Request" : "New Handover" }]}
      />
      <RequestForm key={id || "new"} requestId={id} />
    </>
  );
}

export default function NewRequestPage() {
  return <Suspense fallback={<PageSkeleton />}><Inner /></Suspense>;
}
