// export const getSessions = async () => {
//   const response = await axios('http://localhost:4004/api/v1/sessions?page=1&page_size=4')
//   return response.data
// }

import API from "../config/apiClient"

export type OverviewResponse = {
  day: {
    status: "clocked_in" | "clocked_out";
    longest_session_seconds: number;
    session_count: number;
    first_session_at: string | null;
    goal_seconds: number;
    worked_seconds: number;
    active_session: {
      id: string;
      start_time: string;
    } | null;
  };
  week: {
    total_time_seconds: number;
    longest_session_seconds: number;
    session_count: number;
    daily_average_seconds: number;
    goal_completed_days: number;
    graph: {
      day: string;
      seconds: number;
      goal_met: boolean;
      is_future: boolean;
    }[];
  };
};

export type DashboardActivityResponse = {
  days: number;
  points: {
    date: string;
    time_worked: number;
    session_count: number;
    categories?: { id: string; label: string; color: string | null; seconds: number; tags?: string; is_active?: boolean }[];
    pianiso_technical?: number;
    pianiso_non_technical?: number;
    creating?: number;
    toycon?: number;
  }[];
};

export type Session = {
  id: string;
  category_id: string;
  category?: {
    id: string;
    label: string;
    color?: string | null;
  } | null;
  status: string;
  is_active: boolean;
  start_time: string;
  end_time: string | null;
  elapsed_time: number | null;
  tags: string;
  notes: string;
}

export const getOverview = async (signal?: AbortSignal): Promise<OverviewResponse> => {
  const response = await API.get("/api/v1/overview", { signal });
  return response.data;
};

export const getDashboardActivity = async (
  days: number,
  signal?: AbortSignal
): Promise<DashboardActivityResponse> => {
  const response = await API.get("/api/v1/dashboard/activity", {
    params: { days },
    signal,
  });

  return response.data;
};

export type SessionPage = {
  items: Session[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export const getSessions = async (page = 1, pageSize = 10, signal?: AbortSignal): Promise<SessionPage> => {
  const response = await API.get<SessionPage>('/api/v1/sessions', {
    params: { page, page_size: pageSize },
    signal,
  });
  return response.data;
};

export const deleteSession = async (sessionId: string) => {
  const response = await API.delete(`/api/v1/sessions/${sessionId}`);
  return response.data;
};
