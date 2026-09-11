import * as React from "react";
import type { DashboardActivityResponse } from "@/lib/api";
import { getCategoryColor, getComponentLabel } from "@/lib/category-presentation";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Rectangle, XAxis, type RectangleProps } from "recharts";

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
  ChartLegend,
  ChartLegendContent,
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

function getSections(point: DashboardActivityResponse["points"][number]) {
  const legacySections = [
    { id: "pianiso_technical", label: "Pianiso", tags: "technical", seconds: point.pianiso_technical ?? 0 },
    { id: "pianiso_non_technical", label: "Pianiso", tags: "non_technical", seconds: point.pianiso_non_technical ?? 0 },
    { id: "creating", label: "Creating", tags: "", seconds: point.creating ?? 0 },
    { id: "toycon", label: "Toycon", tags: "", seconds: point.toycon ?? 0 },
  ];
  return (point.categories?.length ? point.categories : legacySections).filter(
    (category: { seconds: number }) => category.seconds > 0
  ) as { id: string; label: string; color?: string | null; seconds: number; tags?: string }[];
}

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
  const livePoints = data.points.map((point) => {
    if (getActivityDateKey(point.date) !== todayKey) return point;

    return {
      ...point,
      time_worked: point.time_worked + (point.categories?.some(category => category.is_active) ? liveDeltaSeconds : 0),
      categories: point.categories?.map(category => ({
        ...category,
        seconds: category.seconds + (category.is_active ? liveDeltaSeconds : 0),
      })),
    };
  });

  const components = Array.from(new Map(
    livePoints.flatMap(point => getSections(point).map(section => [section.id, section] as const))
  ).values()).sort((a, b) => getComponentLabel(a, a.tags).localeCompare(getComponentLabel(b, b.tags)));
  const activityChartConfig: ChartConfig = {
    ...chartConfig,
    ...Object.fromEntries(components.map((component, index) => [
      `activity_${index}`,
      { label: getComponentLabel(component, component.tags), color: getCategoryColor(component, component.tags) },
    ])),
  };
  const chartPoints = livePoints.map(point => {
    const sections = getSections(point);
    return {
      ...point,
      segments: components.map(component => sections
        .filter(section => section.id === component.id)
        .reduce((sum, section) => sum + section.seconds, 0)),
    };
  });

  const plottedPoints = chartPoints.map(point => ({
    ...point,
    ...Object.fromEntries(point.segments.map((seconds, index) => [`activity_${index}`, seconds])),
  }));

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
          config={activityChartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={plottedPoints}
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
              content={(props) => (
                <ChartTooltipContent
                  active={props.active}
                  label={props.label}
                  payload={props.payload?.slice(0, 1)}
                  className="min-w-[260px]"
                  nameKey={activeChart}
                  labelFormatter={(value) => formatTooltipDate(String(value))}
                  formatter={(_value, _name, item, index) => {
                    if (index !== 0) return null;
                    const point = item.payload;
                    const sections = getSections(point);
                    const remainder = Math.max(0, Number(point.time_worked) -
                      sections.reduce((sum, section) => sum + section.seconds, 0));

                    return (
                      <div className="grid w-full gap-2">
                        {activeChart === "time_worked" && (
                          <>
                            {sections.map((section) => (
                              <div key={section.id} className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: getCategoryColor(section, section.tags) }} />
                                  {getComponentLabel(section, section.tags)}
                                </span>
                                <span className="font-mono tabular-nums">{formatDurationSeconds(section.seconds)}</span>
                              </div>
                            ))}

                          </>
                        )}
                        <div className="flex justify-between gap-4 font-medium">
                          <span>{chartConfig[activeChart].label}</span>
                          <span className="font-mono tabular-nums">{formatMetricValue(activeChart, Number(point[activeChart]))}</span>
                        </div>
                        {activeChart === "time_worked" && remainder > 0 && (
                          <span className="max-w-[280px] text-xs text-muted-foreground">
                            Category details are missing from the API response. Restart the backend to load the full breakdown.
                          </span>
                        )}
                      </div>
                    );
                  }}
                />
              )}
            />

            <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2" />} />

            {activeChart === "time_worked" ? components.map((component, index) => (
              <Bar
                key={component.id}
                dataKey={`activity_${index}`}
                name={getComponentLabel(component, component.tags)}
                stackId="activity"
                fill={`var(--color-activity_${index})`}
                isAnimationActive={false}
                shape={(props: unknown) => {
                  const bar = props as RectangleProps & { payload: { segments: number[] } };
                  const segments = bar.payload.segments;
                  const isTop = segments[index] > 0 &&
                    !segments.slice(index + 1).some(seconds => seconds > 0);
                  const isBottom = segments[index] > 0 &&
                    !segments.slice(0, index).some(seconds => seconds > 0);
                  return <Rectangle {...bar} radius={[
                    isTop ? 4 : 0, isTop ? 4 : 0,
                    isBottom ? 4 : 0, isBottom ? 4 : 0,
                  ]} />;
                }}
              />
            )) : (
              <Bar
                dataKey="session_count"
                fill="var(--color-session_count)"
                radius={[4, 4, 4, 4]}
              />
            )}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export default DashboardActivityChart;
