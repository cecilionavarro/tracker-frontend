// export const getSessions = async () => {
//   const response = await axios('http://localhost:4004/api/v1/sessions?page=1&page_size=4')
//   return response.data
// }

import API from "../config/apiClient"

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

export const getSessions = async (): Promise<Session[]> => {
  const response = await API.get('/api/v1/sessions', {
    params: { page: 1, page_size: 10 }
  })
  return response.data.items
}
