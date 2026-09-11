import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import { sessionsQueryOptions } from "@/queryOptions/sessionsQueryOptions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SessionsTable() {
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch } = useQuery(
    sessionsQueryOptions(pagination.page, pagination.pageSize)
  );

  // Deleting the final row on the final page can reduce the available page count.
  if (data && !isPlaceholderData && pagination.page > Math.max(1, data.total_pages)) {
    setPagination({ ...pagination, page: Math.max(1, data.total_pages) });
  }

  if (isPending) return <div role="status" className="tracker-detail p-4">Loading sessions…</div>;
  if (isError) return (
    <div role="alert" className="flex flex-wrap items-center gap-3 tracker-body p-4">
      Failed to load sessions.
      <Button variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button>
      <Button variant="outline" size="sm" onClick={() => setPagination({ ...pagination, page: 1 })}>First page</Button>
    </div>
  );

  const pageCount = Math.max(1, data.total_pages);
  const first = data.items.length ? (data.page - 1) * data.page_size + 1 : 0;
  const last = data.items.length ? first + data.items.length - 1 : 0;
  const changePage = (page: number) => setPagination({ ...pagination, page });

  return (
    <section aria-label="Sessions" aria-busy={isFetching} className="min-w-0 space-y-4">
      <p className="tracker-detail px-4 sm:hidden">Swipe the table to see all columns.</p>
      <DataTable columns={columns} data={data.items} />
      <div className="flex flex-wrap items-center justify-between tracker-body gap-4 px-4 pb-4">
        <span role="status" className="tracker-detail">
          {isPlaceholderData ? "Loading sessions…" : `${first}–${last} of ${data.total.toLocaleString()} sessions`}
        </span>
        <div className="flex w-full flex-wrap items-center justify-between gap-4 sm:w-auto sm:gap-6">
          <div className="flex items-center gap-2">
            <label htmlFor="sessions-page-size" className="tracker-label">Rows per page</label>
            <Select value={String(pagination.pageSize)} disabled={isFetching}
              onValueChange={value => setPagination({ page: 1, pageSize: Number(value) })}>
              <SelectTrigger id="sessions-page-size" size="sm" className="tracker-body h-11 w-20 sm:h-8"><SelectValue /></SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 50, 100].map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <span className="tracker-body tabular-nums">Page {data.page} of {pageCount}</span>
          <nav aria-label="Session pagination" className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="size-11 sm:size-8" aria-label="First page"
              disabled={isFetching || data.page <= 1} onClick={() => changePage(1)}><ChevronsLeft /></Button>
            <Button variant="outline" size="icon" className="size-11 sm:size-8" aria-label="Previous page"
              disabled={isFetching || data.page <= 1} onClick={() => changePage(data.page - 1)}><ChevronLeft /></Button>
            <Button variant="outline" size="icon" className="size-11 sm:size-8" aria-label="Next page"
              disabled={isFetching || data.page >= pageCount} onClick={() => changePage(data.page + 1)}><ChevronRight /></Button>
            <Button variant="outline" size="icon" className="size-11 sm:size-8" aria-label="Last page"
              disabled={isFetching || data.page >= pageCount} onClick={() => changePage(pageCount)}><ChevronsRight /></Button>
          </nav>
        </div>
      </div>
    </section>
  );
}
