import { useQuery } from "@tanstack/react-query"
import axios from 'axios'
export const SESSIONS = "session";

const getSessions = async () => {
  const response = await axios('http://localhost:4004/api/v1/sessions?page=1&page_size=4')
  return response.data
}

const App = () => {
  const { data } = useQuery({
    queryKey: [SESSIONS],
    queryFn: getSessions
  })

  return (
    <div>{JSON.stringify(data)}</div>
  )
}

export default App