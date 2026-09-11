import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SESSIONS } from "@/queryOptions/sessionsQueryOptions";
import { OVERVIEW } from "@/queryOptions/overviewQueryOptions";
import { DASHBOARD_ACTIVITY } from "@/queryOptions/dashboardActivityQueryOptions";
import { API_BASE_URL } from "@/config/apiClient";
import type { SessionPage } from "@/lib/api";
import { getActiveDurationSeconds } from "@/lib/time";

const WS_PATH = "/api/v1/ws/dashboard/";

type DashboardSocketPayload = {
  type?: string;
  data?: {
    clocked_in?: boolean;
  };
};

export function useDashboardWebSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + WS_PATH;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      let payload: DashboardSocketPayload | null = null;

      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = null;
      }

      if (
        payload?.type === "state_update" ||
        payload?.type === "status_update"
      ) {
        const clockedIn = payload?.data?.clocked_in;

        if (clockedIn === false) {
          const nowIso = new Date().toISOString();

          queryClient.setQueriesData<SessionPage>({ queryKey: [SESSIONS] }, (old) => {
            if (!old) return old;

            return { ...old, items: old.items.map((session) => {
              if (!session.is_active) return session;

              const elapsed = getActiveDurationSeconds(
                session.start_time,
                session.end_time,
                Date.now()
              );

              return {
                ...session,
                is_active: false,
                end_time: nowIso,
                elapsed_time: elapsed,
              };
            }) };
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: [SESSIONS] });
      queryClient.refetchQueries({ queryKey: [OVERVIEW] });
      queryClient.refetchQueries({ queryKey: [DASHBOARD_ACTIVITY] });
    };

    return () => {
      socket.close();
    };
  }, [queryClient]);
}