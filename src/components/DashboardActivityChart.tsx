import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { dashboardActivityQueryOptions } from "@/queryOptions/dashboardActivityQueryOptions";
import { overviewQueryOptions } from "@/queryOptions/overviewQueryOptions";
import { useNow } from "@/hooks/useNow";
import { formatDurationSeconds } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  views: {
    label: "Activity",
  },
  time_worked: {
    label: "Time worked",
    color: "var(--chart-2)",
  },
  session_count: {
    label: "Sessions",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

type ActiveChart = "time_worked" | "session_count";

function formatMetricValue(chart: ActiveChart, value: number) {
  if (chart === "time_worked") {
    return formatDurationSeconds(value);
  }

  return value.toLocaleString();
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (year && month && day) {
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

function formatDate(value: string) {
  return parseDateOnly(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTooltipDate(value: string) {
  return parseDateOnly(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLocalDateKey(value: number) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getActivityDateKey(value: string) {
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

  if (dateOnly) return dateOnly;

  return formatLocalDateKey(parseDateOnly(value).getTime());
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

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return Math.max(
    0,
    Math.floor((now - Math.max(dataUpdatedAt, today.getTime())) / 1000)
  );
}

export function DashboardActivityChart() {
  const now = useNow(1000);
  const [activeChart, setActiveChart] =
    React.useState<ActiveChart>("time_worked");

  const { data, dataUpdatedAt, isPending, isError } = useQuery(
    dashboardActivityQueryOptions(30)
  );
  const { data: overview } = useQuery(overviewQueryOptions());

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time Worked</CardTitle>
          <CardDescription>Loading chart...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time Worked</CardTitle>
          <CardDescription>Failed to load chart.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const liveDeltaSeconds = getLiveDeltaSeconds({
    activeStartTime: overview?.day.active_session?.start_time,
    dataUpdatedAt,
    now,
  });

  const todayKey = formatLocalDateKey(now);
  const hasTodayPoint = data.points.some((point) => {
    return getActivityDateKey(point.date) === todayKey;
  });

  const livePoints = data.points.map((point) => {
    if (getActivityDateKey(point.date) !== todayKey) return point;

    return {
      ...point,
      time_worked: point.time_worked + liveDeltaSeconds,
    };
  });

  if (!hasTodayPoint && liveDeltaSeconds > 0) {
    livePoints.push({
      date: todayKey,
      time_worked: liveDeltaSeconds,
      session_count: 0,
    });
  }

  const total = {
    time_worked: livePoints.reduce((sum, point) => sum + point.time_worked, 0),
    session_count: data.points.reduce(
      (sum, point) => sum + point.session_count,
      0
    ),
  };

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-0!">
          <CardTitle>Time Worked</CardTitle>
          <CardDescription>
            Showing activity for the last {data.days} days
          </CardDescription>
        </div>

        <div className="flex">
          {(["time_worked", "session_count"] as ActiveChart[]).map((key) => (
            <button
              key={key}
              type="button"
              data-active={activeChart === key}
              className="w-95 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-t-0 sm:border-l sm:px-8 sm:py-6 "
              onClick={() => setActiveChart(key)}
            >
              <span className="text-xs text-muted-foreground">
                {chartConfig[key].label}
              </span>
              <span className="text-lg leading-none sm:text-3xl">
                {formatMetricValue(key, total[key])}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={livePoints}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatDate}
            />

            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[185px]"
                  nameKey={activeChart}
                  labelFormatter={(value) => formatTooltipDate(String(value))}
                  formatter={(value) => (
                    <span className="leading-none text-muted-foreground">
                      {chartConfig[activeChart].label}:{" "}
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {formatMetricValue(activeChart, Number(value))}
                      </span>
                    </span>
                  )}
                />
              }
            />

            <Bar
              dataKey={activeChart}
              fill={`var(--color-${activeChart})`}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export default DashboardActivityChart;
