import { useQuery } from "@tanstack/react-query";
import { memo, useMemo } from "react";
import { getWeekDateLabels } from "@/lib/dashboard-date";
import { overviewQueryOptions } from "@/queryOptions/overviewQueryOptions";
import { useNow } from "@/hooks/useNow";
import { formatDurationSeconds } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric", minute: "2-digit", hour12: true,
});

function formatTime(iso: string | null) {
  if (!iso) return "-";

  return timeFormatter.format(new Date(iso));
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
  const goalMet = goalSeconds > 0 && workedSeconds >= goalSeconds;
  const progress = goalSeconds > 0 ? Math.max(0, Math.min(workedSeconds / goalSeconds, 1)) : 0;
  const duration = formatDurationSeconds(workedSeconds);
  const circumference = 2 * Math.PI * 90;

  return (
    <Card className="tracker-panel min-w-0 gap-1">
      <CardHeader>
        <CardTitle className="tracker-label">Goal</CardTitle>
      </CardHeader>
      <CardContent>
        {/* A circle only needs its stroke length updated, not a chart layout
            and axis calculation on every one-second clock tick. */}
        <div className="relative mx-auto aspect-square w-full max-w-[200px]">
          <svg
            viewBox="0 0 200 200"
            className="block h-full w-full"
            role="img"
            aria-label={`Daily work goal: ${duration} worked toward a ${formatDurationSeconds(goalSeconds)} goal`}
          >
            <circle cx="100" cy="100" r="90" fill="none" stroke="var(--muted)" strokeWidth="20" />
            {progress > 0 && (
              <circle
                cx="100" cy="100" r="90" fill="none"
                stroke={goalMet ? "#22c55e" : "var(--chart-2)"}
                strokeWidth="20" strokeLinecap="round"
                strokeDasharray={`${circumference * progress} ${circumference}`}
                transform="rotate(-90 100 100)"
              />
            )}
          </svg>
          <div className="absolute inset-0 mx-auto flex w-[76%] flex-col items-center justify-center gap-1 text-center">
            <p className="tracker-value flex flex-wrap justify-center gap-x-1">
              <span className="sr-only">{duration}</span>
              {duration.split(" ").map((value, index) => (
                <span key={index} aria-hidden="true" className="whitespace-nowrap">{value}</span>
              ))}
            </p>
            <p className="tracker-detail">Time worked</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const MetricCard = memo(function MetricCard({
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
});

function WeekGoalCard({
  days,
  graph,
  goalSeconds,
  snapshotAt,
}: {
  days: number;
  snapshotAt: number;
  goalSeconds: number;
  graph: {
    day: string;
    seconds: number;
    goal_met: boolean;
    is_future: boolean;
  }[];
}) {
  const dateLabels = useMemo(() => getWeekDateLabels(snapshotAt), [snapshotAt]);
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
            const dayName = dateLabels[index] ?? day.day;
            const status = day.is_future
              ? "Future day"
              : day.goal_met
                ? "Goal completed"
                : "Goal not completed";

            return (
              <Tooltip key={`${day.day}-${index}`}>
                <TooltipTrigger asChild>
                  <div
                    role="img"
                    tabIndex={0}
                    aria-label={`${dayName}: ${formatDurationSeconds(day.seconds)} worked. ${status}.`}
                    className="flex min-w-0 cursor-default flex-col items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                </TooltipTrigger>
                <TooltipContent
                  showArrow={false}
                  side="top"
                  sideOffset={8}
                  className="tracker-body grid min-w-40 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-foreground shadow-xl"
                >
                  <span className="font-medium">{dayName}</span>
                  <div className="flex w-full items-center justify-between gap-4 font-medium">
                    <span>Time worked</span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums">
                      {formatDurationSeconds(day.seconds)}
                    </span>
                  </div>
                  <span className="text-muted-foreground">{status}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

const Overview = () => {
  const { data, dataUpdatedAt, isError, isFetching, refetch } = useQuery(overviewQueryOptions());

  const isClockedIn = data?.day.status === "clocked_in";
  const now = useNow(isClockedIn);
  if (!data) {
    return (
      <section aria-label="Overview" className="pb-4">
        <div role={isError ? "alert" : "status"} className="tracker-detail flex items-center gap-2 pb-3">
          {isError ? "Couldn’t load the overview." : "Loading overview…"}
          {isError && <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>Retry</Button>}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4" aria-hidden="true">
          {["Status", "Longest session", "First session", "Goal", "Time Working", "Longest session", "Week daily avg", "Goal completed past week"].map((title, index) => (
            <Card key={index} className="tracker-panel min-h-40 min-w-0">
              <CardHeader><CardTitle className="tracker-label">{title}</CardTitle></CardHeader>
              <CardContent><div className="h-5 w-2/3 rounded bg-muted" /></CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }
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

  const todayIndex = data.week.graph.reduce(
    (latest, day, index) => day.is_future ? latest : index, -1
  );

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
        snapshotAt={dataUpdatedAt}
        days={liveGoalCompletedDays}
        graph={liveWeekGraph}
        goalSeconds={data.day.goal_seconds}
      />
    </div>
  );
};

export default Overview;
