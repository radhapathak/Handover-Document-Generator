import { config } from "@/lib/config";
import { getStore } from "@/lib/store";
import { column, fromRecord, tableName, toRecord, type TableKey } from "@/lib/servicenow/schema";
import { IntegrationError } from "@/lib/store/types";

export interface Query {
  where?: Record<string, string>;
  whereIn?: Record<string, string[]>;
  orderBy?: string;
  desc?: boolean;
  limit?: number;
  offset?: number;
}

/** Typed CRUD over one HandoverAI table, independent of the backend. */
export function repository<T extends { id: string }>(key: TableKey) {
  const name = () => tableName(key, config.servicenow.tablePrefix);
  const mapWhere = (w?: Record<string, string>) =>
    w ? Object.fromEntries(Object.entries(w).map(([k, v]) => [column(key, k), v])) : undefined;
  const mapWhereIn = (w?: Record<string, string[]>) =>
    w ? Object.fromEntries(Object.entries(w).map(([k, v]) => [column(key, k), v])) : undefined;

  return {
    table: name,
    async list(q: Query = {}): Promise<{ items: T[]; total: number }> {
      const r = await getStore().list(name(), {
        where: mapWhere(q.where),
        whereIn: mapWhereIn(q.whereIn),
        orderBy: column(key, q.orderBy || "createdAt"),
        desc: q.desc ?? true,
        limit: q.limit ?? 100,
        offset: q.offset ?? 0,
      });
      return { items: r.records.map((x) => fromRecord<T>(key, x)), total: r.total };
    },
    async all(q: Omit<Query, "limit" | "offset"> = {}, max = 1000): Promise<T[]> {
      const out: T[] = [];
      for (let offset = 0; offset < max; offset += 200) {
        const { items, total } = await this.list({ ...q, limit: 200, offset });
        out.push(...items);
        if (out.length >= total || items.length === 0) break;
      }
      return out;
    },
    async get(id: string): Promise<T | null> {
      const r = await getStore().get(name(), id);
      return r ? fromRecord<T>(key, r) : null;
    },
    async getOrThrow(id: string): Promise<T> {
      const r = await this.get(id);
      if (!r) throw new IntegrationError(`${key.replace(/_/g, " ")} not found`, 404);
      return r;
    },
    async create(data: Partial<T>): Promise<T> {
      return fromRecord<T>(key, await getStore().create(name(), toRecord(key, data as Record<string, unknown>)));
    },
    async update(id: string, data: Partial<T>): Promise<T> {
      return fromRecord<T>(key, await getStore().update(name(), id, toRecord(key, data as Record<string, unknown>)));
    },
    async remove(id: string): Promise<void> {
      await getStore().remove(name(), id);
    },
  };
}
