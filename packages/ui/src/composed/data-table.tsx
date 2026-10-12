"use client"

import { useEffect, useId } from "react"
import {
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  createFilteredRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  filterFn_includesString,
  filterFn_equalsString,
  sortFn_text,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
  type RowData,
} from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  UnfoldMoreIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@workspace/ui/components/table"

const features = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    equalsString: filterFn_equalsString,
  },
  sortFns: { text: sortFn_text, basic: sortFn_basic },
})

export type DataTableColumn<T extends RowData> = ColumnDef<typeof features, T>

export function DataTable<T extends RowData>({
  data,
  columns,
  getRowId,
  label,
  search,
  filter,
  empty,
  initialSorting = [],
  paginationCopy,
  formatNumber = String,
}: {
  data: T[]
  columns: DataTableColumn<T>[]
  getRowId: (row: T) => string
  label: string
  search: { columnId: string; label: string }
  filter: {
    columnId: string
    label: string
    allLabel: string
    options: { value: string; label: string }[]
  }
  empty: string
  initialSorting?: SortingState
  paginationCopy: {
    rowsPerPage: string
    previousPage: string
    nextPage: string
    page: string
    of: string
  }
  formatNumber?: (value: number) => string
}) {
  const id = useId()
  const table = useTable({
    features,
    data,
    columns,
    getRowId,
    defaultColumn: { filterFn: "includesString", sortFn: "text" },
    initialState: {
      sorting: initialSorting,
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    autoResetPageIndex: false,
  })
  const pageCount = Math.max(1, table.getPageCount())
  const pageIndex = table.state.pagination.pageIndex
  useEffect(() => {
    if (pageIndex >= pageCount) table.setPageIndex(pageCount - 1)
  }, [pageIndex, pageCount, table])
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-[1_1_12rem] sm:max-w-sm">
          <Label htmlFor={`${id}-search`} className="sr-only">
            {search.label}
          </Label>
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${id}-search`}
            placeholder={search.label}
            className="h-9 pl-9"
            value={String(
              table.getColumn(search.columnId)?.getFilterValue() ?? ""
            )}
            onChange={(event) => {
              table
                .getColumn(search.columnId)
                ?.setFilterValue(event.target.value)
              table.setPageIndex(0)
            }}
          />
        </div>
        <Select
          items={[{ value: "all", label: filter.allLabel }, ...filter.options]}
          value={String(
            table.getColumn(filter.columnId)?.getFilterValue() ?? "all"
          )}
          onValueChange={(value) => {
            table
              .getColumn(filter.columnId)
              ?.setFilterValue(value === "all" ? undefined : value)
            table.setPageIndex(0)
          }}
        >
          <SelectTrigger
            aria-label={filter.label}
            className="max-w-full min-w-40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="motion-reduce:animate-none">
            <SelectItem value="all">{filter.allLabel}</SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <div
          role="region"
          aria-label={label}
          tabIndex={0}
          className="overflow-x-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset [&>[data-slot=table-container]]:overflow-visible"
        >
          <Table aria-label={label} className="min-w-[38rem]">
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted()
                    const actions = header.column.id === "actions"
                    return (
                      <TableHead
                        key={header.id}
                        aria-sort={
                          sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : header.column.getCanSort()
                                ? "none"
                                : undefined
                        }
                        className={
                          actions
                            ? "sticky right-0 z-10 w-14 bg-card px-3 text-right"
                            : "px-4"
                        }
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 h-9 transition-none"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <table.FlexRender header={header} />
                            <HugeiconsIcon
                              icon={
                                sorted === "asc"
                                  ? ArrowUp01Icon
                                  : sorted === "desc"
                                    ? ArrowDown01Icon
                                    : UnfoldMoreIcon
                              }
                              className="size-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </Button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="transition-none">
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        cell.column.id === "actions"
                          ? "sticky right-0 z-10 bg-card px-3 text-right"
                          : "px-4 py-3"
                      }
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {table.getRowModel().rows.length === 0 && (
          <div
            role="status"
            className="flex min-h-40 items-center justify-center border-t px-4 py-8 text-center text-sm text-muted-foreground"
          >
            {empty}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Label htmlFor={`${id}-page-size`} className="text-muted-foreground">
            {paginationCopy.rowsPerPage}
          </Label>
          <Select
            items={[10, 20, 50].map((size) => ({
              value: String(size),
              label: formatNumber(size),
            }))}
            value={String(table.state.pagination.pageSize)}
            onValueChange={(value) => {
              if (value) {
                table.setPageSize(Number(value))
                table.setPageIndex(0)
              }
            }}
          >
            <SelectTrigger id={`${id}-page-size`} className="h-8 w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="motion-reduce:animate-none">
              {[10, 20, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {formatNumber(size)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-muted-foreground tabular-nums">
            {paginationCopy.page}{" "}
            {formatNumber(Math.min(pageIndex + 1, pageCount))}{" "}
            {paginationCopy.of} {formatNumber(pageCount)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            {paginationCopy.previousPage}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            {paginationCopy.nextPage}
          </Button>
        </div>
      </div>
    </div>
  )
}
