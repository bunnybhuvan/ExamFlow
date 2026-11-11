import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingBlock } from "./primitives";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface Props<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filter?: (row: T) => boolean;
  toolbar?: ReactNode;
  pageSize?: number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  data, columns, rowKey, searchText, searchPlaceholder = "Search…", filter, toolbar, pageSize = 12,
  loading, error, onRetry, onRowClick, rowActions, emptyTitle = "No records", emptyDescription,
}: Props<T>) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    let r = data ?? [];
    if (filter) r = r.filter(filter);
    if (q && searchText) {
      const n = q.toLowerCase();
      r = r.filter((x) => searchText(x).toLowerCase().includes(n));
    }
    const col = sort && columns.find((c) => c.id === sort.id);
    if (col?.sortValue) {
      const sv = col.sortValue;
      r = [...r].sort((a, b) => { const x = sv(a), y = sv(b); return (x < y ? -1 : x > y ? 1 : 0) * sort!.dir; });
    }
    return r;
  }, [data, filter, q, searchText, sort, columns]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div className="glass overflow-hidden rounded-xl">
      <div className="flex flex-col gap-3 border-b border-border p-3 md:flex-row md:items-center">
        {searchText && (
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={searchPlaceholder} className="pl-8" aria-label="Search table" />
          </div>
        )}
        <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        {data && <span className="text-xs text-muted-foreground tabular-nums">{rows.length} of {data.length}</span>}
      </div>
      {error ? <div className="p-4"><ErrorState error={error} onRetry={onRetry} /></div>
        : loading || !data ? <div className="p-4"><LoadingBlock /></div>
        : rows.length === 0 ? <EmptyState title={emptyTitle} description={q ? "Try a different search or clear filters." : emptyDescription} />
        : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((c) => (
                  <TableHead key={c.id} className={cn("text-xs uppercase tracking-wider", c.className)}
                    aria-sort={sort?.id === c.id ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    {c.sortValue ? (
                      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => setSort((s) => (s?.id === c.id ? (s.dir === 1 ? { id: c.id, dir: -1 } : null) : { id: c.id, dir: 1 }))}>
                        {c.header}
                        {sort?.id === c.id ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : c.header}
                  </TableHead>
                ))}
                {rowActions && <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((row) => (
                <TableRow key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn("transition-colors", onRowClick && "cursor-pointer")}>
                  {columns.map((c) => <TableCell key={c.id} className={c.className}>{c.cell(row)}</TableCell>)}
                  {rowActions && <TableCell onClick={(e) => e.stopPropagation()}>{rowActions(row)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      {data && rows.length > pageSize && (
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>Page {cur + 1} of {pages}</span>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft /></Button>
            <Button size="icon" variant="ghost" aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight /></Button>
          </div>
        </div>
      )}
    </div>
  );
}