/* eslint-disable react-refresh/only-export-components */
import {
  IconDotsVertical,
} from "@tabler/icons-react"
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { deleteSession, type Session } from "../../lib/api";
import { formatDurationSeconds, formatSessionTime } from "@/lib/format";
import { useNow } from "@/hooks/useNow";
import { getActiveDurationSeconds } from "@/lib/time";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { SESSIONS } from "@/queryOptions/sessionsQueryOptions";
import { OVERVIEW } from "@/queryOptions/overviewQueryOptions";
import { DASHBOARD_ACTIVITY } from "@/queryOptions/dashboardActivityQueryOptions";

const CATEGORY_DOT_COLORS: Record<string, string> = {
  creating: "#eab308",
  toycon: "#22c55e",
};

function getCategoryDotColor(session: Session) {
  const category = session.category;
  if (!category) return "#999999";

  const categoryLabel = category.label.trim().toLowerCase();
  const tags = session.tags.trim().toLowerCase();

  if (categoryLabel === "pianiso") {
    if (
      tags.includes("non_technical") ||
      tags.includes("non technical") ||
      tags.includes("non-technical")
    ) {
      return "#f97316";
    }

    if (tags.includes("technical")) {
      return "#ef4444";
    }
  }

  return (
    CATEGORY_DOT_COLORS[categoryLabel] ??
    category.color ??
    "#999999"
  );
}

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

function SessionActionsCell({ session }: { session: Session }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteSession(session.id),
    onSuccess: () => {
      queryClient.setQueryData<Session[]>([SESSIONS], (old) => {
        return old?.filter((item) => item.id !== session.id);
      });

      queryClient.invalidateQueries({ queryKey: [SESSIONS] });
      queryClient.invalidateQueries({ queryKey: [OVERVIEW] });
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_ACTIVITY] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
          size="icon"
          disabled={deleteMutation.isPending}
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
        <DropdownMenuItem
          variant="destructive"
          disabled={deleteMutation.isPending}
          onSelect={() => deleteMutation.mutate()}
        >
          {deleteMutation.isPending ? "Deleting..." : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
            style={{ backgroundColor: getCategoryDotColor(row.original) }}
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
    cell: ({ row }) => <SessionActionsCell session={row.original} />,
  },
];
