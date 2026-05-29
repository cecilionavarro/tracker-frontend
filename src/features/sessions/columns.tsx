import {
  IconDotsVertical,
} from "@tabler/icons-react"
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Session } from "../../lib/api";
import { formatDurationSeconds, formatSessionTime } from "@/lib/format";
import { useNow } from "@/hooks/useNow";
import { getActiveDurationSeconds } from "@/lib/time";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";

function DurationCell({
  row,
  latestStartTime,
}: {
  row: Session;
  latestStartTime: string | null;
}) {
  const isLatest = latestStartTime && row.start_time === latestStartTime;
  const now = useNow(1000);

  const totalSeconds = useMemo(() => {
    if (!isLatest) return row.elapsed_time;
    return getActiveDurationSeconds(row.start_time, row.end_time, now);
  }, [isLatest, row.start_time, row.end_time, row.elapsed_time, now]);

  return (
    <span className="inline-block min-w-[5.5rem] tabular-nums">
      {formatDurationSeconds(totalSeconds)}
    </span>
  );
}

// cell is to format the row's cell
export const columns: ColumnDef<Session>[] = [
  {
    id: "active",
    header: () => null,
    cell: ({ row }) =>
      row.original.is_active ? (
        <div className="flex h-full items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-green-500" />
        </div>
      ) : (
        <div/>
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "elapsed_time",
    header: "Duration",
    cell: ({ row, table }) => {
      const latestStartTime = table
        .getRowModel()
        .rows.reduce<string | null>((latest, r) => {
          const start = r.original.start_time;
          if (!start) return latest;
          if (!latest) return start;
          return Date.parse(start) > Date.parse(latest) ? start : latest;
        }, null);

      return (
        <DurationCell row={row.original} latestStartTime={latestStartTime} />
      );
    },
  },
  {
    accessorKey: "start_time",
    header: "Start",
    cell: ({ getValue }) => formatSessionTime(getValue() as string),
  },
  {
    accessorKey: "end_time",
    header: "End",
    cell: ({ getValue }) => formatSessionTime(getValue() as string | null),
  },
  {
    id: "category",
    header: "Category",
    cell: ({ row }) => {
      const category = row.original.category;
      if (!category) return "—";
      return (
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: category.color ?? "#999999" }}
          />
          <span>{category.label}</span>
        </span>
      );
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return "—";
      return value as string;
    },
  },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
            size="icon"
          >
            <IconDotsVertical />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Make a copy</DropdownMenuItem>
          <DropdownMenuItem>Favorite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
