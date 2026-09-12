import { useCallback, useSyncExternalStore } from "react";
import { createDashboardClock } from "@/lib/dashboard-clock";

const clock = createDashboardClock();
const noSubscribe = () => () => {};

export function useNow(enabled = true, intervalMs = 1) {
  // A stable snapshot lets slower consumers skip React renders between updates,
  // while every consumer continues to share the same underlying timer.
  const getSnapshot = useCallback(() => clock.getSnapshot(intervalMs), [intervalMs]);
  return useSyncExternalStore(
    enabled ? clock.subscribe : noSubscribe,
    getSnapshot,
    getSnapshot,
  );
}
