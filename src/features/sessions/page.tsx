import { columns } from "./columns";
import { DataTable } from "./data-table";
import { sessionsQueryOptions } from "../../queryOptions/sessionsQueryOptions"
import { useSuspenseQuery } from "@tanstack/react-query";
import { useDashboardWebSocket } from "@/hooks/use-dashboard-websocket";

export default function SessionsTable() {
  useDashboardWebSocket();
  const { data, isPending, isError} = useSuspenseQuery(sessionsQueryOptions())

  if (isPending) return <div>Loading...</div>;
  if (isError) return <div>Failed to load sessions.</div>;

  return <DataTable columns={columns} data={data} />;
}
