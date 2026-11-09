import { randomBytes } from "crypto";
import type { RawRecord } from "@/lib/servicenow/schema";
import { toSnDate } from "@/lib/servicenow/schema";
import type { AttachmentMeta, ListOptions, TableStore } from "@/lib/store/types";
import { IntegrationError } from "@/lib/store/types";
import { seedDemoData } from "@/lib/demo/seed";

/**
 * DEMO MODE ONLY. An in-memory store that mimics the ServiceNow Table API so the
 * app can be explored without an instance. Data lives in server memory and is
 * lost on restart / cold start. It is only used when DEMO_MODE=true and no
 * SERVICENOW_INSTANCE_URL is set — never as a silent fallback.
 */
interface DemoDb {
  tables: Map<string, Map<string, RawRecord>>;
  attachments: Map<string, (AttachmentMeta & { key: string })[]>;
  counters: Map<string, number>;
  seeded: boolean;
}

const g = globalThis as unknown as { __haiDemoDb?: DemoDb };

function db(): DemoDb {
  if (!g.__haiDemoDb) {
    g.__haiDemoDb = { tables: new Map(), attachments: new Map(), counters: new Map(), seeded: false };
  }
  return g.__haiDemoDb;
}

function table(name: string) {
  const d = db();
  if (!d.tables.has(name)) d.tables.set(name, new Map());
  return d.tables.get(name)!;
}

export const newSysId = () => randomBytes(16).toString("hex");

const AUTO_NUMBER: Record<string, string> = { document_request: "HDR" };

export const memoryStore: TableStore = {
  kind: "demo",

  async list(name, opts: ListOptions = {}) {
    await ensureSeeded();
    let rows = [...table(name).values()];
    for (const [k, v] of Object.entries(opts.where || {})) rows = rows.filter((r) => (r[k] ?? "") === v);
    for (const [k, vs] of Object.entries(opts.whereIn || {})) rows = rows.filter((r) => vs.includes(r[k] ?? ""));
    if (opts.orderBy) {
      const ob = opts.orderBy;
      rows.sort((a, b) => ((a[ob] ?? "") < (b[ob] ?? "") ? -1 : (a[ob] ?? "") > (b[ob] ?? "") ? 1 : 0));
      if (opts.desc) rows.reverse();
    }
    const total = rows.length;
    const offset = opts.offset ?? 0;
    return { records: rows.slice(offset, offset + (opts.limit ?? 100)).map((r) => ({ ...r })), total };
  },

  async get(name, sysId) {
    await ensureSeeded();
    const r = table(name).get(sysId);
    return r ? { ...r } : null;
  },

  async create(name, values) {
    await ensureSeeded();
    const now = toSnDate(new Date().toISOString());
    const rec: RawRecord = { sys_created_on: now, sys_updated_on: now, ...values, sys_id: values.sys_id || newSysId() };
    const suffix = Object.keys(AUTO_NUMBER).find((k) => name.endsWith(k));
    if (suffix && !rec.number) {
      const d = db();
      const n = (d.counters.get(name) || 1000) + 1;
      d.counters.set(name, n);
      rec.number = `${AUTO_NUMBER[suffix]}${String(n).padStart(7, "0")}`;
    }
    table(name).set(rec.sys_id, rec);
    return { ...rec };
  },

  async update(name, sysId, values) {
    await ensureSeeded();
    const t = table(name);
    const cur = t.get(sysId);
    if (!cur) throw new IntegrationError("Record not found", 404);
    const rec = { ...cur, ...values, sys_id: sysId, sys_updated_on: toSnDate(new Date().toISOString()) };
    t.set(sysId, rec);
    return { ...rec };
  },

  async remove(name, sysId) {
    table(name).delete(sysId);
  },

  async uploadAttachment(name, sysId, fileName, contentType, data) {
    const key = `${name}:${sysId}`;
    const d = db();
    const meta = {
      id: newSysId(),
      fileName,
      contentType,
      sizeBytes: data.length,
      createdAt: toSnDate(new Date().toISOString()),
      key,
    };
    d.attachments.set(key, [...(d.attachments.get(key) || []), meta]);
    return meta;
  },

  async listAttachments(name, sysId) {
    return db().attachments.get(`${name}:${sysId}`) || [];
  },
};

let seeding: Promise<void> | null = null;
async function ensureSeeded() {
  const d = db();
  if (d.seeded) return;
  if (!seeding) {
    seeding = (async () => {
      d.seeded = true; // set first so seed writes don't recurse
      await seedDemoData(memoryStore);
    })();
  }
  await seeding;
}

/** Test helper. */
export function resetDemoStore() {
  g.__haiDemoDb = undefined;
  seeding = null;
}
