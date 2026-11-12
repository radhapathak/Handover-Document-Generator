import { describe, expect, it, beforeEach } from "vitest";
import { fromRecord, toRecord, toIso, toSnDate } from "@/lib/servicenow/schema";
import { sanitizeMermaid } from "@/lib/mermaid/sanitize";
import { canTransition, estimateHoursSaved, nextState, isEditable } from "@/lib/documents/lifecycle";
import { deriveStatus, sanitizeSectionHtml } from "@/lib/documents/html";
import { htmlToBlocks } from "@/lib/documents/blocks";
import { moduleConfigInput, requestInput, reviewInput } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { safeQueryValue } from "@/lib/store/types";
import { redact } from "@/lib/audit";
import type { GeneratedDocument } from "@/types";

describe("ServiceNow record mapping", () => {
  it("round-trips entities through raw records", () => {
    const raw = toRecord("generated_document", {
      title: "Doc", state: "approved", currentVersion: 3, content: { sections: [] }, estimatedHoursSaved: 14.5, approvedAt: "2026-01-02T03:04:05.000Z",
    });
    expect(raw).toMatchObject({ title: "Doc", state: "approved", current_version: "3", content_json: '{"sections":[]}', approved_on: "2026-01-02 03:04:05" });
    const back = fromRecord<GeneratedDocument>("generated_document", { ...raw, sys_id: "abc", sys_created_on: "2026-01-01 00:00:00" });
    expect(back).toMatchObject({ id: "abc", currentVersion: 3, estimatedHoursSaved: 14.5, approvedAt: "2026-01-02T03:04:05Z", createdAt: "2026-01-01T00:00:00Z" });
    expect(back.content).toEqual({ sections: [] });
  });
  it("enforces ServiceNow max lengths", () => {
    expect(() => toRecord("project", { name: "x".repeat(201) })).toThrow(/maximum length/);
  });
  it("converts dates", () => {
    expect(toSnDate("2026-05-06T07:08:09.123Z")).toBe("2026-05-06 07:08:09");
    expect(toIso("2026-05-06 07:08:09")).toBe("2026-05-06T07:08:09Z");
  });
  it("rejects encoded-query injection", () => {
    expect(() => safeQueryValue("abc^ORsys_id!=x")).toThrow();
    expect(safeQueryValue("abc123")).toBe("abc123");
  });
});

describe("Mermaid validation", () => {
  it("accepts a flowchart and strips fences", () => {
    const r = sanitizeMermaid("```mermaid\nflowchart TD\n A([Start]) --> B{Ok?}\n B -->|Yes| C([End])\n```");
    expect(r.ok).toBe(true);
    expect(r.code.startsWith("flowchart TD")).toBe(true);
  });
  it("removes click/init directives and rejects other diagram types", () => {
    const r = sanitizeMermaid('flowchart TD\n%%{init: {"theme":"dark"}}%%\nA-->B\nB-->C\nclick A "javascript:alert(1)"');
    expect(r.code).not.toMatch(/click|init|javascript/);
    expect(sanitizeMermaid("sequenceDiagram\nA->>B: hi").ok).toBe(false);
    expect(sanitizeMermaid("flowchart TD\nA[open --> B").ok).toBe(false);
  });
});

describe("Lifecycle", () => {
  it("allows the documented transitions only", () => {
    expect(nextState("submit", "ai_generated")).toBe("under_review");
    expect(nextState("approve", "under_review")).toBe("approved");
    expect(nextState("publish", "approved")).toBe("published");
    expect(nextState("submit", "changes_requested")).toBe("under_review");
    expect(canTransition("approve", "ai_generated")).toBe(false);
    expect(canTransition("publish", "under_review")).toBe(false);
    expect(() => nextState("publish", "draft")).toThrow();
    expect(isEditable("under_review")).toBe(false);
    expect(isEditable("changes_requested")).toBe(true);
  });
  it("estimates hours saved conservatively", () => {
    expect(estimateHoursSaved(16, 90, 1)).toBe(15);
    expect(estimateHoursSaved(1, 7200, 1)).toBe(0);
  });
});

describe("HTML handling", () => {
  it("sanitises AI/editor HTML to the allow-list", () => {
    const out = sanitizeSectionHtml('<h2>T</h2><p onclick="x">Hi <a href="javascript:1">link</a><script>alert(1)</script><img src=x></p><table><tr><td style="color:red">c</td></tr></table>');
    expect(out).toBe("<h3>T</h3><p>Hi link</p><table><tr><td>c</td></tr></table>");
  });
  it("derives section status from the exact phrases", () => {
    expect(deriveStatus("<p>Information Required: SLA durations</p>")).toBe("information_required");
    expect(deriveStatus("<p>Configuration Conflict Detected: rules overlap</p>")).toBe("conflict");
    expect(deriveStatus("<p>All good</p>", "ok")).toBe("ok");
  });
  it("converts HTML to export blocks", () => {
    const b = htmlToBlocks("<h4>Sub</h4><p>Some <strong>bold</strong> text</p><ul><li>a<ul><li>b</li></ul></li></ul><table><thead><tr><th>H</th></tr></thead><tbody><tr><td>v</td></tr></tbody></table>");
    expect(b.map((x) => x.type)).toEqual(["heading", "paragraph", "list", "table"]);
    expect(b[2]).toMatchObject({ items: [{ level: 0 }, { level: 1 }] });
    expect(b[3]).toMatchObject({ rows: [{ header: true, cells: ["H"] }, { header: false, cells: ["v"] }] });
  });
});

describe("Validation", () => {
  it("drops empty list rows and rejects unknown fields", () => {
    const v = moduleConfigInput.parse({ categories: [{ name: "HW" }, { name: " " }], businessRules: [] });
    expect(v.categories).toEqual([{ name: "HW" }]);
    expect(() => moduleConfigInput.parse({ hacker: "x" })).toThrow();
  });
  it("requires module name and a project", () => {
    expect(() => requestInput.parse({ project: { existingId: "abc" }, moduleName: "", documentType: "KT", config: {} })).toThrow();
    expect(requestInput.parse({ project: { existingId: "abc" }, moduleName: "Incident", documentType: "KT Summary", config: {} }).moduleName).toBe("Incident");
  });
  it("requires comments when rejecting", () => {
    expect(() => reviewInput.parse({ action: "rejected" })).toThrow();
    expect(reviewInput.parse({ action: "approved" }).comments).toBe("");
  });
});

describe("Rate limiting", () => {
  it("blocks after the limit", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, 3);
    expect(() => rateLimit(key, 3)).toThrow(/Too many/);
  });
});

describe("Log redaction", () => {
  it("never logs API keys or credentials", () => {
    const out = redact('TypeError: "Bearer gsk_abcDEF123456" invalid; Basic dXNlcjpwYXNz; password=hunter2 {"api_key":"xyz"}');
    expect(out).not.toMatch(/abcDEF123456|dXNlcjpwYXNz|hunter2|xyz/);
  });
});
