import DashboardActivityChart from "@/components/DashboardActivityChart";
import Overview from "@/components/Overview";
import SessionsTable from "@/features/sessions/page";
import { useDashboardWebSocket } from "@/hooks/use-dashboard-websocket";

const Home = () => {
  useDashboardWebSocket();

  return (
    <div className="mx-auto w-full max-w-[1600px] min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <Overview />

      <div className="pb-4">
        <DashboardActivityChart />
      </div>

      <SessionsTable />
    </div>
  );
};

export default Home;
