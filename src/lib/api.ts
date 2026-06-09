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

export const getOverview = async (): Promise<OverviewResponse> => {
  const response = await API.get("/api/v1/overview");
  return response.data;
};

export const getSessions = async (): Promise<Session[]> => {
  const response = await API.get('/api/v1/sessions', {
    params: { page: 1, page_size: 10 }
  })
  return response.data.items
}