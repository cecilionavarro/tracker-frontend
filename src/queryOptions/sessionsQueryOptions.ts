import { queryOptions } from "@tanstack/react-query";
import { getSessions } from "../lib/api";
export const SESSIONS = "session";

export function sessionsQueryOptions() {
  return queryOptions({
    queryKey: [SESSIONS],
    queryFn: getSessions
  })
}