import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getDashboardActivity } from "@/lib/api";

export const DASHBOARD_ACTIVITY = "dashboard-activity";

export function dashboardActivityQueryOptions(days: number) {
  return queryOptions({
    queryKey: [DASHBOARD_ACTIVITY, days],
    queryFn: ({ signal }) => getDashboardActivity(days, signal),
    placeholderData: keepPreviousData,
  });
}
