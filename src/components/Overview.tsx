import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Label,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

import { overviewQueryOptions } from "@/queryOptions/overviewQueryOptions";
import { useNow } from "@/hooks/useNow";
import { formatDurationSeconds } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChartContainer, type ChartConfig } from "./ui/chart";

const chartConfig = {
  seconds: {
    label: "Seconds",
  },
  workDay: {
    label: "Work Day",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function formatTime(iso: string | null) {
  if (!iso) return "-";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function getActiveSeconds(startTime: string | null | undefined, now: number) {
  if (!startTime) return 0;

  const start = Date.parse(startTime);
  if (Number.isNaN(start)) return 0;

  return Math.max(0, Math.floor((now - start) / 1000));
}

function getActiveSecondsSinceLocalMidnight(
  startTime: string | null | undefined,
  now: number
) {
  if (!startTime) return 0;

  const start = Date.parse(startTime);
  if (Number.isNaN(start)) return 0;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const effectiveStart = Math.max(start, today.getTime());

  return Math.max(0, Math.floor((now - effectiveStart) / 1000));
}

function getLiveDeltaSeconds({
  activeStartTime,
  dataUpdatedAt,
  now,
}: {
  activeStartTime: string | null | undefined;
  dataUpdatedAt: number;
  now: number;
}) {
  if (!activeStartTime) return 0;

  return Math.max(0, Math.floor((now - dataUpdatedAt) / 1000));
}

function GoalCard({
  workedSeconds,
  goalSeconds,
}: {
  workedSeconds: number;
  goalSeconds: number;
}) {
  const goalMet = workedSeconds >= goalSeconds;
  const cappedWorkedSeconds = Math.min(workedSeconds, goalSeconds);

  const chartData = [
    {
      workDay: "goal",
      seconds: cappedWorkedSeconds,
      fill: goalMet ? "#22c55e" : "var(--color-workDay)",
    },
  ];

  return (
    <Card className="tracker-panel min-w-0 gap-1">
      <CardHeader>
        <CardTitle className="tracker-label">Goal</CardTitle>
      </CardHeader>

      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square w-full max-w-[200px]"
        >
          <RadialBarChart
            data={chartData}
            startAngle={90}
            endAngle={-270}
            outerRadius="100%"
            innerRadius="80%"
            barCategoryGap={0}
            barGap={0}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <PolarAngleAxis type="number" domain={[0, goalSeconds]} tick={false} />
            <RadialBar dataKey="seconds" background={{ fill: "var(--muted)" }} cornerRadius={4} />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                const cx = Number(viewBox.cx);
                const cy = Number(viewBox.cy);
                const duration = formatDurationSeconds(workedSeconds);
                return (
                  <foreignObject x={cx * 0.24} y={0} width={cx * 1.52} height={cy * 2}>
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                      <p className="tracker-value flex flex-wrap justify-center gap-x-1" aria-label={duration}>
                        {duration.split(" ").map((value, index) => (
                          <span key={index} aria-hidden="true" className="whitespace-nowrap">{value}</span>
                        ))}
                      </p>
                      <p className="tracker-detail">Time worked</p>
                    </div>
                  </foreignObject>
                );
              }} />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  subTitle,
  subValue,
  active,
}: {
  title: string;
  value: string;
  subTitle?: string;
  subValue?: string;
  active?: boolean;
}) {
  return (
    <Card className="tracker-panel min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 tracker-label">
          {active && <span className="active-session-dot h-2 w-2 shrink-0 rounded-full bg-green-500" />}
          {title}
        </CardTitle>

        <p className="tracker-value">{value}</p>

        {subTitle && (
          <div className="tracker-label-group pt-2">
            <CardTitle className="tracker-label">{subTitle}</CardTitle>
            <p className="tracker-value">{subValue}</p>
          </div>
        )}
      </CardHeader>
    </Card>
  );
}

function WeekGoalCard({
  days,
  graph,
  goalSeconds,
}: {
  days: number;
  goalSeconds: number;
  graph: {
    day: string;
    seconds: number;
    goal_met: boolean;
    is_future: boolean;
  }[];
}) {
  return (
    <Card className="tracker-panel min-w-0">
      <CardHeader>
        <CardTitle className="tracker-label">
          Goal completed past week
        </CardTitle>

        <p className="tracker-value">
          {days} {days === 1 ? "day" : "days"}
        </p>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 xl:gap-3">
          {graph.map((day, index) => {
            const percent = !day.is_future && goalSeconds > 0
              ? Math.max(0, Math.min(day.seconds / goalSeconds, 1)) * 100
              : 0;

            return (
              <div
                key={`${day.day}-${index}`}
                className="flex min-w-0 flex-col items-center gap-1"
              >
                <span className="tracker-detail">{day.day}</span>

                <div className="relative aspect-[1/2] w-full overflow-hidden rounded-md bg-neutral-800">
                  <div
                    className={
                      day.goal_met
                        ? "absolute inset-x-0 bottom-0 w-full rounded-md bg-green-500"
                        : "absolute inset-x-0 bottom-0 w-full rounded-md bg-blue-600"
                    }
                    style={{
                      height: `${percent}%`,
                      minHeight: percent > 0 ? "4px" : 0,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

const Overview = () => {
  const now = useNow(1000);
  const { data, dataUpdatedAt } = useSuspenseQuery(overviewQueryOptions());

  const isClockedIn = data.day.status === "clocked_in";
  const activeStartTime = data.day.active_session?.start_time;

  const activeSeconds = getActiveSeconds(activeStartTime, now);

  const activeTodaySeconds = getActiveSecondsSinceLocalMidnight(
    activeStartTime,
    now
  );

  const liveDeltaSeconds = getLiveDeltaSeconds({
    activeStartTime,
    dataUpdatedAt,
    now,
  });

  const liveDayWorkedSeconds = data.day.worked_seconds + liveDeltaSeconds;
  const liveWeekWorkedSeconds = data.week.total_time_seconds + liveDeltaSeconds;

  const liveDayLongestSeconds = Math.max(
    data.day.longest_session_seconds,
    activeTodaySeconds
  );

  const liveWeekLongestSeconds = Math.max(
    data.week.longest_session_seconds,
    activeSeconds
  );

  const daysElapsed =
    data.week.graph.filter((day) => !day.is_future).length || 1;

  const liveWeekDailyAverageSeconds = Math.floor(
    liveWeekWorkedSeconds / daysElapsed
  );

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(new Date(now))[0];

  const todayIndex = data.week.graph.findIndex((day) => {
    return !day.is_future && day.day === todayLabel;
  });

  const liveWeekGraph = data.week.graph.map((day, index) => {
    if (index !== todayIndex) return day;

    const liveSeconds = day.seconds + liveDeltaSeconds;

    return {
      ...day,
      seconds: liveSeconds,
      goal_met: liveSeconds >= data.day.goal_seconds,
    };
  });

  const liveGoalCompletedDays = liveWeekGraph.filter((day) => {
    return day.goal_met;
  }).length;

  return (
    <div className="grid grid-cols-2 gap-3 pb-4 md:grid-cols-4 lg:gap-4">
      <MetricCard
        title="Status"
        value={isClockedIn ? "Clocked In" : "Clocked Out"}
        active={isClockedIn}
      />

      <MetricCard
        title="Longest session"
        value={formatDurationSeconds(liveDayLongestSeconds)}
        subTitle="Sessions"
        subValue={String(data.day.session_count)}
      />

      <MetricCard
        title="First session"
        value={formatTime(data.day.first_session_at)}
      />

      <GoalCard
        workedSeconds={liveDayWorkedSeconds}
        goalSeconds={data.day.goal_seconds}
      />

      <MetricCard
        title="Time Working"
        value={formatDurationSeconds(liveWeekWorkedSeconds)}
      />

      <MetricCard
        title="Longest session"
        value={formatDurationSeconds(liveWeekLongestSeconds)}
        subTitle="Sessions"
        subValue={String(data.week.session_count)}
      />

      <MetricCard
        title="Week daily avg"
        value={formatDurationSeconds(liveWeekDailyAverageSeconds)}
      />

      <WeekGoalCard
        days={liveGoalCompletedDays}
        graph={liveWeekGraph}
        goalSeconds={data.day.goal_seconds}
      />
    </div>
  );
};

export default Overview;
