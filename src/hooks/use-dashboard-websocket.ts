import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SESSIONS } from "@/queryOptions/sessionsQueryOptions";
import { API_BASE_URL } from "@/config/apiClient";
import type { Session } from "@/lib/api";
import { getActiveDurationSeconds } from "@/lib/time";

const WS_PATH = "/api/v1/ws/dashboard/";

export function useDashboardWebSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + WS_PATH;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      let payload: any = null;
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = null;
      }

      // If backend only tells us clocked_in state, update the active row locally
      if (
        payload?.type === "state_update" ||
        payload?.type === "status_update"
      ) {
        const clockedIn = payload?.data?.clocked_in;
        if (clockedIn === false) {
          const nowIso = new Date().toISOString();
          queryClient.setQueryData<Session[]>([SESSIONS], (old) => {
            if (!old) return old;
            return old.map((s) => {
              if (!s.is_active) return s;
              const elapsed = getActiveDurationSeconds(
                s.start_time,
                s.end_time,
                Date.now()
              );
              return {
                ...s,
                is_active: false,
                end_time: nowIso,
                elapsed_time: elapsed,
              };
            });
          });
        }
      }

      // Always refetch to stay in sync with backend
      queryClient.refetchQueries({ queryKey: [SESSIONS] });
    };

    return () => {
      socket.close();
    };
  }, [queryClient]);
}
