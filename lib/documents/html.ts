import sanitizeHtml from "sanitize-html";
import { CONFLICT_DETECTED, INFO_REQUIRED } from "@/lib/documents/sections";
import type { SectionStatus } from "@/types";

const ALLOWED_TAGS = ["h3", "h4", "p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr"];

/** Strict allow-list sanitiser for AI output and editor input (no links, scripts, styles or attributes). */
export function sanitizeSectionHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { th: ["colspan", "rowspan"], td: ["colspan", "rowspan"] },
    disallowedTagsMode: "discard",
    transformTags: { h1: "h3", h2: "h3", h5: "h4", h6: "h4" },
  }).trim();
}

export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

/** Section status is derived from the content itself so it always matches what the reader sees. */
export function deriveStatus(html: string, aiStatus?: SectionStatus): SectionStatus {
  const t = htmlToText(html);
  if (t.includes(CONFLICT_DETECTED)) return "conflict";
  if (t.includes(INFO_REQUIRED)) return "information_required";
  return aiStatus === "conflict" || aiStatus === "information_required" ? aiStatus : "ok";
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Markdown (assistant replies) → safe HTML. */
export async function markdownToSafeHtml(md: string): Promise<string> {
  const { marked } = await import("marked");
  const html = await marked.parse(md, { async: true, gfm: true });
  return sanitizeHtml(html, {
    allowedTags: ["h1", "h2", "h3", "h4", "p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "code", "pre", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr"],
    allowedAttributes: {},
  });
}
