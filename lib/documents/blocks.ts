import { parse, NodeType, type HTMLElement, type Node } from "node-html-parser";

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
}

export type Block =
  | { type: "heading"; level: 3 | 4; runs: Run[] }
  | { type: "paragraph"; runs: Run[] }
  | { type: "list"; ordered: boolean; items: { level: number; runs: Run[] }[] }
  | { type: "table"; rows: { header: boolean; cells: string[] }[] }
  | { type: "code"; text: string }
  | { type: "quote"; runs: Run[] };

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

function runs(node: Node, style: Omit<Run, "text"> = {}): Run[] {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const text = decode(node.rawText).replace(/\s+/g, " ");
    return text ? [{ text, ...style }] : [];
  }
  if (node.nodeType !== NodeType.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase();
  if (tag === "br") return [{ text: "\n", ...style }];
  const next = { ...style };
  if (tag === "strong" || tag === "b") next.bold = true;
  if (tag === "em" || tag === "i") next.italic = true;
  if (tag === "u") next.underline = true;
  if (tag === "code") next.code = true;
  return el.childNodes.flatMap((c) => runs(c, next));
}

function trimRuns(rs: Run[]): Run[] {
  if (!rs.length) return rs;
  const out = rs.map((r) => ({ ...r }));
  out[0].text = out[0].text.replace(/^\s+/, "");
  out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, "");
  return out.filter((r) => r.text !== "");
}

function textOf(el: HTMLElement): string {
  // Lists inside table cells become "1. a; 2. b"
  const lists = el.querySelectorAll("li");
  if (lists.length) return lists.map((li, i) => `${i + 1}. ${decode(li.text).trim()}`).join("\n");
  return decode(el.text).replace(/\s+/g, " ").trim();
}

function listItems(el: HTMLElement, level: number, out: { level: number; runs: Run[] }[]) {
  for (const li of el.childNodes) {
    if ((li as HTMLElement).tagName?.toLowerCase() !== "li") continue;
    const liEl = li as HTMLElement;
    const own = liEl.childNodes.filter((c) => !["ul", "ol"].includes((c as HTMLElement).tagName?.toLowerCase()));
    out.push({ level, runs: trimRuns(own.flatMap((c) => runs(c))) });
    for (const sub of liEl.childNodes) {
      const t = (sub as HTMLElement).tagName?.toLowerCase();
      if (t === "ul" || t === "ol") listItems(sub as HTMLElement, level + 1, out);
    }
  }
}

export function htmlToBlocks(html: string): Block[] {
  const root = parse(`<div>${html}</div>`).firstChild as HTMLElement;
  const blocks: Block[] = [];
  let loose: Run[] = [];
  const flush = () => {
    const r = trimRuns(loose);
    if (r.length) blocks.push({ type: "paragraph", runs: r });
    loose = [];
  };
  for (const node of root.childNodes) {
    const tag = (node as HTMLElement).tagName?.toLowerCase();
    const el = node as HTMLElement;
    switch (tag) {
      case "h3":
      case "h4":
        flush();
        blocks.push({ type: "heading", level: tag === "h3" ? 3 : 4, runs: trimRuns(runs(el)) });
        break;
      case "p":
        flush();
        {
          const r = trimRuns(runs(el));
          if (r.length) blocks.push({ type: "paragraph", runs: r });
        }
        break;
      case "ul":
      case "ol": {
        flush();
        const items: { level: number; runs: Run[] }[] = [];
        listItems(el, 0, items);
        if (items.length) blocks.push({ type: "list", ordered: tag === "ol", items });
        break;
      }
      case "table": {
        flush();
        const rows = el.querySelectorAll("tr").map((tr) => {
          const cells = tr.childNodes.filter((c) => ["td", "th"].includes((c as HTMLElement).tagName?.toLowerCase())) as HTMLElement[];
          return { header: cells.length > 0 && cells.every((c) => c.tagName.toLowerCase() === "th"), cells: cells.map(textOf) };
        });
        if (rows.length) blocks.push({ type: "table", rows });
        break;
      }
      case "pre":
        flush();
        blocks.push({ type: "code", text: decode(el.text) });
        break;
      case "blockquote":
        flush();
        blocks.push({ type: "quote", runs: trimRuns(runs(el)) });
        break;
      case "hr":
        flush();
        break;
      default:
        loose.push(...runs(node));
    }
  }
  flush();
  return blocks;
}
