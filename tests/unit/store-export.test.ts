import { describe, expect, it, beforeAll } from "vitest";
import { projects } from "@/lib/servicenow/projects";
import { generatedDocuments } from "@/lib/servicenow/documents";
import { findEmployeeByUserName } from "@/lib/servicenow/employees";
import { buildExportInput } from "@/lib/documents/export";
import { buildDocx } from "@/lib/documents/export-docx";
import { buildPdf } from "@/lib/documents/export-pdf";
import { getStore } from "@/lib/store";

beforeAll(() => {
  delete process.env.SERVICENOW_INSTANCE_URL;
  process.env.DEMO_MODE = "true";
});

describe("data mode selection", () => {
  it("never falls back silently", () => {
    process.env.DEMO_MODE = "false";
    expect(() => getStore()).toThrow(/No data source configured/);
    process.env.DEMO_MODE = "true";
    expect(getStore().kind).toBe("demo");
  });
});

describe("demo store via repositories", () => {
  it("seeds, filters and updates", async () => {
    expect((await findEmployeeByUserName("meera.nair"))?.role).toBe("admin");
    const { items, total } = await projects.list({ where: { status: "active" } });
    expect(total).toBeGreaterThan(0);
    expect(items.every((p) => p.status === "active")).toBe(true);
    const p = await projects.create({ name: "Unit Test Project", status: "on_hold" });
    expect((await projects.update(p.id, { status: "completed" })).status).toBe("completed");
  });
});

describe("exports", () => {
  it("builds DOCX and PDF files with all sections", async () => {
    const [doc] = (await generatedDocuments.list({ where: { state: "published" }, limit: 1 })).items;
    const input = await buildExportInput(doc);
    expect(input.sections.length).toBe(23);
    expect(input.revisions.length).toBeGreaterThan(0);
    const docx = await buildDocx(input);
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    const pdf = await buildPdf(input);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  }, 30000);
});
