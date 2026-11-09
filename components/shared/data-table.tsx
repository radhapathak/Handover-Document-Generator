"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown } from "lucide-react";
import { EmptyState, Input, Select, cx } from "@/components/shared/ui";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

export interface FilterDef<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  test: (row: T, value: string) => boolean;
}

export function DataTable<T extends { id: string }>({
  rows, columns, searchText, filters = [], pageSize = 10, emptyTitle = "No records", emptyMessage, onRowClick, toolbar,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText?: (row: T) => string;
  filters?: FilterDef<T>[];
  pageSize?: number;
  emptyTitle?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [fv, setFv] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const filtered = useMemo(() => {
    let r = rows;
    const needle = q.trim().toLowerCase();
    if (needle && searchText) r = r.filter((x) => searchText(x).toLowerCase().includes(needle));
    for (const f of filters) if (fv[f.key]) r = r.filter((x) => f.test(x, fv[f.key]));
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) r = [...r].sort((a, b) => (col.sortValue!(a) > col.sortValue!(b) ? 1 : col.sortValue!(a) < col.sortValue!(b) ? -1 : 0) * sort.dir);
    }
    return r;
  }, [rows, q, fv, filters, searchText, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const shown = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div>
      {(searchText || filters.length > 0 || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          {searchText && (
            <div className="relative min-w-[200px] flex-1 md:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input aria-label="Search" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="pl-8" />
            </div>
          )}
          {filters.map((f) => (
            <Select key={f.key} aria-label={f.label} value={fv[f.key] || ""} onChange={(e) => { setFv({ ...fv, [f.key]: e.target.value }); setPage(0); }} className="w-auto min-w-[150px]">
              <option value="">{f.label}: All</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ))}
          <div className="ml-auto flex items-center gap-2">{toolbar}</div>
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState title={emptyTitle} message={rows.length ? "No records match your search or filters." : emptyMessage} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface text-[12px] uppercase tracking-wide text-muted">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={cx("whitespace-nowrap px-4 py-2 font-medium", c.className)}>
                    {c.sortValue ? (
                      <button className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 })}>
                        {c.header}<ArrowUpDown className="h-3 w-3" />
                      </button>
                    ) : c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cx(onRowClick && "cursor-pointer hover:bg-brand-50/60")}>
                  {columns.map((c) => <td key={c.key} className={cx("px-4 py-2.5 align-middle", c.className)}>{c.render(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[12.5px] text-muted">
          <span>{cur * pageSize + 1}–{Math.min(filtered.length, (cur + 1) * pageSize)} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="rounded p-1 hover:bg-surface disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span>Page {cur + 1} of {pages}</span>
            <button aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="rounded p-1 hover:bg-surface disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
