import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Label,
  PolarAngleAxis,
  PolarGrid,
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
    <Card>
      <CardHeader>
        <CardTitle className="text-gray-400">Goal</CardTitle>
      </CardHeader>

      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto h-[180px] w-[180px]"
        >
          <RadialBarChart
            data={chartData}
            startAngle={0}
            endAngle={360}
            outerRadius={120}
            innerRadius={80}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, goalSeconds]}
              tick={false}
            />

            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[90, 80]}
            />

            <RadialBar dataKey="seconds" background cornerRadius={10} />

            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-lg font-bold"
                        >
                          {formatDurationSeconds(workedSeconds)}
                        </tspan>
                      </text>
                    );
                  }

                  return null;
                }}
              />
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-400">
          {active && <span className="h-2 w-2 rounded-full bg-green-500" />}
          {title}
        </CardTitle>

        <p className="text-4xl">{value}</p>

        {subTitle && (
          <div className="pt-4">
            <p className="text-gray-400">{subTitle}</p>
            <p className="text-4xl">{subValue}</p>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-gray-400">
          Goal completed past week
        </CardTitle>

        <p className="text-4xl">
          {days} {days === 1 ? "day" : "days"}
        </p>
      </CardHeader>

      <CardContent>
        <div className="flex gap-2">
          {graph.map((day, index) => {
            const percent = !day.is_future && goalSeconds > 0
              ? Math.max(0, Math.min(day.seconds / goalSeconds, 1)) * 100
              : 0;

            return (
              <div
                key={`${day.day}-${index}`}
                className="flex flex-col items-center gap-1"
              >
                <span className="text-xs text-gray-400">{day.day}</span>

                <div className="relative h-20 w-8 overflow-hidden rounded-md bg-neutral-800">
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
    <div className="grid grid-cols-4 gap-4 pb-4">
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
