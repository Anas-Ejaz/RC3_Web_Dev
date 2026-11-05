"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => number;
  isLoading?: boolean;
  empty?: React.ReactNode;
  selectable?: boolean;
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
  maxSelectable?: number;
  caption?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading,
  empty,
  selectable,
  selectedIds = [],
  onSelectionChange,
  maxSelectable,
  caption,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sortValue || !sort) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = sv(a);
      const y = sv(b);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns]);

  const toggleRow = (id: number) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) onSelectionChange(selectedIds.filter((x) => x !== id));
    else if (!maxSelectable || selectedIds.length < maxSelectable) onSelectionChange([...selectedIds, id]);
  };

  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable && <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>}
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <TableHead key={c.key} className={c.className} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground"
                      onClick={() => setSort(active && sort!.dir === "desc" ? { key: c.key, dir: "asc" } : { key: c.key, dir: "desc" })}
                    >
                      {c.header}
                      {active ? sort!.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: colCount }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          {!isLoading && sorted.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colCount} className="p-0">{empty}</TableCell>
            </TableRow>
          )}
          {!isLoading &&
            sorted.map((row) => {
              const id = getRowId(row);
              const checked = selectedIds.includes(id);
              return (
                <TableRow key={id} data-state={checked ? "selected" : undefined} className={cn(checked && "bg-lime-soft/40")}>
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={checked}
                        disabled={!checked && !!maxSelectable && selectedIds.length >= maxSelectable}
                        onCheckedChange={() => toggleRow(id)}
                        aria-label={`Select row ${id}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>{c.cell(row)}</TableCell>
                  ))}
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}