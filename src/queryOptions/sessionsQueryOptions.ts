import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getSessions } from "../lib/api";
export const SESSIONS = "session";

export function sessionsQueryOptions(page = 1, pageSize = 10) {
  return queryOptions({
    queryKey: [SESSIONS, page, pageSize],
    queryFn: ({ signal }) => getSessions(page, pageSize, signal),
    placeholderData: keepPreviousData,
  });
}
