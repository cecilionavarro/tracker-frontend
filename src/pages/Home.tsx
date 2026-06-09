
import Overview from "@/components/Overview"
import SessionsTable from "@/features/sessions/page"
import { useDashboardWebSocket } from "@/hooks/use-dashboard-websocket"


const Home = () => {
  useDashboardWebSocket()

  return (
    <div className="container mx-auto">
      <Overview />
      <SessionsTable />
    </div>
  )
}

export default Home
