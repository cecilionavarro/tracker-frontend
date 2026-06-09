import { queryOptions } from "@tanstack/react-query";
import { getOverview } from "@/lib/api";

export const OVERVIEW = "overview";

export function overviewQueryOptions() {
  return queryOptions({
    queryKey: [OVERVIEW],
    queryFn: getOverview,
  });
}