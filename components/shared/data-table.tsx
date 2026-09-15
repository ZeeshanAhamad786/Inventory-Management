"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

const EMPTY: Record<string, unknown>[] = [];

export interface DataColumn<T> {
  id: string;
  header: string;
  accessor?: (row: T) => unknown;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T extends object>({
  data,
  columns,
  searchPlaceholder = "Search",
  extraFilters,
  onRowClick,
  pageSize = 12,
}: {
  data: T[];
  columns: DataColumn<T>[];
  searchPlaceholder?: string;
  extraFilters?: React.ReactNode;
  onRowClick?: (row: T) => void;
  pageSize?: number;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const helper = useMemo(() => createColumnHelper<typeof features, T>(), []);
  const tableColumns = useMemo(
    () =>
      helper.columns(
        columns.map((column) =>
          helper.accessor((row) => (column.accessor ? column.accessor(row) : (row as Record<string, unknown>)[column.id]), {
            id: column.id,
            header: column.header,
            cell: (ctx) => (column.cell ? column.cell(ctx.row.original) : String(ctx.getValue() ?? "—")),
          }),
        ),
      ),
    [columns, helper],
  );

  const table = useTable(
    {
      features,
      columns: tableColumns,
      data: (data as T[]) ?? (EMPTY as unknown as T[]),
      globalFilterFn: "includesString",
      initialState: { pagination: { pageIndex: 0, pageSize } },
    },
    (state) => ({
      pagination: state.pagination,
      sorting: state.sorting,
      globalFilter: state.globalFilter,
    }),
  );

  React.useEffect(() => {
    table.setGlobalFilter(globalFilter);
  }, [globalFilter, table]);

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={searchPlaceholder}
          className="max-w-sm"
        />
        {extraFilters}
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler?.()}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {(table.state.pagination?.pageIndex ?? 0) + 1} of {table.getPageCount() || 1}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
