import * as React from "react";
import type { DashboardActivityResponse } from "@/lib/api";
import { getCategoryColor, getComponentLabel } from "@/lib/category-presentation";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Rectangle, XAxis, YAxis, type RectangleProps } from "recharts";
import type { TooltipProps } from "recharts/types/component/Tooltip";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { dashboardActivityQueryOptions } from "@/queryOptions/dashboardActivityQueryOptions";
import { overviewQueryOptions } from "@/queryOptions/overviewQueryOptions";
import { sessionsQueryOptions } from "@/queryOptions/sessionsQueryOptions";
import { normalizeActivityData, advanceActivityPoint } from "@/lib/activity-live";
import { useNow } from "@/hooks/useNow";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDurationSeconds } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
const ACTIVITY_RANGES = [7, 30, 90] as const;
type ActivityRange = (typeof ACTIVITY_RANGES)[number];

function getSections(point: DashboardActivityResponse["points"][number]) {
  const legacySections = [
    { id: "pianiso_technical", label: "Pianiso", tags: "technical", seconds: point.pianiso_technical ?? 0 },
    { id: "pianiso_non_technical", label: "Pianiso", tags: "non_technical", seconds: point.pianiso_non_technical ?? 0 },
    { id: "creating", label: "Creating", tags: "", seconds: point.creating ?? 0 },
    { id: "toycon", label: "Toycon", tags: "", seconds: point.toycon ?? 0 },
  ];
  return (point.categories?.length ? point.categories : legacySections).filter(
    (category: { seconds: number; is_active?: boolean }) => category.seconds > 0 || category.is_active
  ) as { id: string; label: string; color?: string | null; seconds: number; tags?: string; is_active?: boolean }[];
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
  return axisDateFormatter.format(parseDateOnly(value));
}

function formatTooltipDate(value: string) {
  return tooltipDateFormatter.format(parseDateOnly(value));
}

const axisDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric",
});
const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
});

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

function getBarCornerRadius({ width = 0, height = 0 }: RectangleProps, maxRadius: number) {
  return Math.min(maxRadius, Math.abs(width) * 0.15, Math.abs(height) / 2);
}

function LiveActivityTotal({ data, dataUpdatedAt, activeStartTime, isPlaceholderData }: {
  data: DashboardActivityResponse;
  dataUpdatedAt: number;
  activeStartTime: string | undefined;
  isPlaceholderData: boolean;
}) {
  const now = useNow(Boolean(activeStartTime));
  const todayKey = formatLocalDateKey(now);
  const delta = isPlaceholderData ? 0 : getLiveDeltaSeconds({ activeStartTime, dataUpdatedAt, now });
  const total = data.points.reduce((sum, point) => sum + point.time_worked + (
    getActivityDateKey(point.date) === todayKey && point.categories?.some(category => category.is_active)
      ? delta : 0
  ), 0);
  return <>{formatDurationSeconds(total)}</>;
}

type ActivityTooltipProps = Omit<TooltipProps<ValueType, NameType>, "content"> & {
  activeChart: ActiveChart;
  activeStartTime: string | undefined;
  dataUpdatedAt: number;
  data: DashboardActivityResponse;
  isPlaceholderData: boolean;
};

function LiveActivityTooltip({
  activeChart,
  activeStartTime,
  dataUpdatedAt,
  data,
  isPlaceholderData,
  ...props
}: ActivityTooltipProps) {
  // Only the open tooltip subscribes to the one-second clock. The bars keep
  // their cheaper ten-second geometry refresh.
  const now = useNow(Boolean(props.active && activeStartTime));
  const payload = props.payload?.slice(0, 1).map((item) => {
    // Recharts can retain a hover payload until the pointer moves. Read the
    // matching raw API point each tick, so refreshes cannot double-count time.
    const point = data.points.find(point => point.date === item.payload?.date);
    if (!point) return item;
    const delta = isPlaceholderData || activeChart !== "time_worked" ? 0
      : getLiveDeltaSeconds({ activeStartTime, dataUpdatedAt, now });
    const livePoint = advanceActivityPoint(point, delta);
    return { ...item, payload: livePoint, value: livePoint[activeChart] };
  });

  return (
    <ChartTooltipContent
      {...props}
      payload={payload}
      className="tracker-body w-[260px] max-w-[calc(100vw-48px)]"
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
            {activeChart === "time_worked" && sections.map((section) => (
              <div key={section.id} className="flex items-center justify-between gap-4">
                <span className="tracker-detail flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: getCategoryColor(section, section.tags) }} />
                  {getComponentLabel(section, section.tags)}
                </span>
                <span className="shrink-0 whitespace-nowrap tracker-body tabular-nums">{formatDurationSeconds(section.seconds)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-4 font-medium">
              <span>{chartConfig[activeChart].label}</span>
              <span className="shrink-0 whitespace-nowrap tracker-body tabular-nums">{formatMetricValue(activeChart, Number(point[activeChart]))}</span>
            </div>
            {activeChart === "time_worked" && remainder > 0 && (
              <span className="tracker-detail max-w-[280px]">
                Category details are missing from the API response. Restart the backend to load the full breakdown.
              </span>
            )}
          </div>
        );
      }}
    />
  );
}

export function DashboardActivityChart() {
  const isMobile = useIsMobile();
  const maxCornerRadius = isMobile ? 1 : 4;
  const [activeChart, setActiveChart] =
    React.useState<ActiveChart>("time_worked");
  const [rangeDays, setRangeDays] = React.useState<ActivityRange>(30);

  const { data: response, dataUpdatedAt, isFetching, isError, isPlaceholderData, refetch } = useQuery(
    dashboardActivityQueryOptions(rangeDays)
  );
  const { data: overview } = useQuery(overviewQueryOptions());
  const { data: recentSessions } = useQuery({
    ...sessionsQueryOptions(),
    enabled: overview?.day.status === "clocked_in"
      && Boolean(response && !response.points.at(-1)?.categories?.length),
  });
  const activeSession = recentSessions?.items.find(session =>
    session.id === overview?.day.active_session?.id && session.is_active && !session.end_time);
  const data = React.useMemo(() => response
    ? normalizeActivityData(response, activeSession) : undefined, [response, activeSession]);
  // Bar geometry needs less frequent updates than the live text. API events
  // still render immediately, including clock-in/out and range changes.
  const now = useNow(overview?.day.status === "clocked_in" && activeChart === "time_worked", 10_000);

  // Category definitions and historical segments change only on an API update.
  const { components, activityChartConfig, basePoints } = React.useMemo(() => {
    const points = data?.points ?? [];
    const components = Array.from(new Map(
      points.flatMap(point => getSections(point).map(section => [section.id, section] as const))
    ).values()).sort((a, b) => getComponentLabel(a, a.tags).localeCompare(getComponentLabel(b, b.tags)));
    const activityChartConfig: ChartConfig = {
      ...chartConfig,
      ...Object.fromEntries(components.map((component, index) => [
        `activity_${index}`,
        { label: getComponentLabel(component, component.tags), color: getCategoryColor(component, component.tags) },
      ])),
    };
    const basePoints = points.map(point => {
      const sections = new Map(getSections(point).map(section => [section.id, section.seconds]));
      const segments = components.map(component => sections.get(component.id) ?? 0);
      return {
        ...point, segments,
        ...Object.fromEntries(segments.map((seconds, index) => [`activity_${index}`, seconds])),
      };
    });
    return { components, activityChartConfig, basePoints };
  }, [data]);

  const rangeControls = (
    <div
      role="group"
      aria-label="Activity date range"
      className="mt-3 grid w-full max-w-xs grid-cols-3 overflow-hidden rounded-md border"
    >
      {ACTIVITY_RANGES.map((days) => (
        <button
          key={days}
          type="button"
          aria-label={`Last ${days} days`}
          aria-pressed={rangeDays === days}
          className="tracker-body min-h-11 px-3 py-2 whitespace-nowrap border-l first:border-l-0 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-pressed:bg-muted"
          onClick={() => setRangeDays(days)}
        >
          {days} days
        </button>
      ))}
    </div>
  );

  const requestStatus = (
    <div role="status" className="tracker-detail">
      {isError ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>Couldn’t load activity for the last {rangeDays} days.</span>
          <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : (!data || isPlaceholderData) ? (
        `Loading activity for the last ${rangeDays} days…`
      ) : null}
    </div>
  );

  if (!data) {
    return (
      <Card className="tracker-panel min-w-0">
        <CardHeader>
          <CardTitle>Time Worked</CardTitle>
          <CardDescription>Showing activity for the last {rangeDays} days</CardDescription>
          {rangeControls}
        </CardHeader>
        <CardContent className="h-[300px] sm:h-[280px]">{requestStatus}</CardContent>
      </Card>
    );
  }

  // Placeholder data has no update timestamp; don't count time from midnight
  // while a different range is loading.
  const liveDeltaSeconds = isPlaceholderData ? 0 : getLiveDeltaSeconds({
    activeStartTime: overview?.day.active_session?.start_time,
    dataUpdatedAt,
    now,
  });

  const todayKey = formatLocalDateKey(now);
  const livePoints = basePoints.map((point) => {
    if (getActivityDateKey(point.date) !== todayKey) return point;

    const segments = point.segments.map((seconds, index) => seconds + (
      point.categories?.some(category => category.id === components[index].id && category.is_active)
        ? liveDeltaSeconds : 0
    ));

    return {
      ...point,
      segments,
      ...Object.fromEntries(segments.map((seconds, index) => [`activity_${index}`, seconds])),
      time_worked: point.time_worked + (point.categories?.some(category => category.is_active) ? liveDeltaSeconds : 0),
      categories: point.categories?.map(category => ({
        ...category,
        seconds: category.seconds + (category.is_active ? liveDeltaSeconds : 0),
      })),
    };
  });

  const total = {
    time_worked: livePoints.reduce((sum, point) => sum + point.time_worked, 0),
    session_count: data.points.reduce(
      (sum, point) => sum + point.session_count,
      0
    ),
  };

  const maximumSeconds = Math.max(0, ...livePoints.map(point => point.time_worked));
  const timeUnit = maximumSeconds >= 3600 || maximumSeconds === 0
    ? { seconds: 3600, suffix: "h" }
    : maximumSeconds >= 60
      ? { seconds: 60, suffix: "m" }
      : { seconds: 1, suffix: "s" };
  const axisUnit = activeChart === "time_worked" ? timeUnit.seconds : 1;
  const axisMaximum = Math.max(1, ...livePoints.map(point => point[activeChart] / axisUnit));
  // Choose whole-unit intervals first, then convert back to the chart's raw units.
  const minimumStep = Math.max(1, axisMaximum / 5);
  const magnitude = 10 ** Math.floor(Math.log10(minimumStep));
  const tickStep = [1, 2, 5, 10].find(step => step * magnitude >= minimumStep)! * magnitude;
  const axisTicks = Array.from(
    { length: Math.ceil(axisMaximum / tickStep) + 1 },
    (_, index) => index * tickStep * axisUnit
  );

  return (
    <Card className="tracker-panel min-w-0 py-0">
      <CardHeader className="flex flex-col items-stretch border-b p-0! lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3 sm:p-4">
          <CardTitle>Time Worked</CardTitle>
          <CardDescription>
            Showing activity for the last {data.days} days
          </CardDescription>
          {rangeControls}
        </div>

        <div className="grid min-w-0 grid-cols-2 lg:w-1/2">
          {(["time_worked", "session_count"] as ActiveChart[]).map((key) => (
            <button
              key={key}
              type="button"
              data-active={activeChart === key}
              className="relative z-30 flex min-w-0 flex-col justify-center gap-1 border-t p-3 text-left even:border-l data-[active=true]:bg-muted/50 sm:p-4 lg:border-t-0 lg:border-l"
              onClick={() => setActiveChart(key)}
            >
              <span className="tracker-label">
                {chartConfig[key].label}
              </span>
              <span className="tracker-value">
                {key === "time_worked" ? (
                  <LiveActivityTotal
                    data={data}
                    dataUpdatedAt={dataUpdatedAt}
                    activeStartTime={overview?.day.active_session?.start_time}
                    isPlaceholderData={isPlaceholderData}
                  />
                ) : formatMetricValue(key, total[key])}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="min-w-0 px-3 pb-3 sm:px-4 sm:pb-4">
        {requestStatus}
        <ChartContainer
          aria-busy={isPlaceholderData}
          config={activityChartConfig}
          className="aspect-auto h-[300px] w-full min-w-0 sm:h-[280px]"
        >
          <BarChart
            accessibilityLayer
            data={livePoints}
            margin={{
              left: 0,
              right: 0,
            }}
          >
            <CartesianGrid vertical={false} />

            <YAxis
              width={40}
              domain={[0, axisTicks[axisTicks.length - 1]]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              ticks={axisTicks}
              interval="preserveStart"
              minTickGap={12}
              allowDecimals={false}
              tick={({ y, payload }) => (
                <text
                  x={0}
                  y={y}
                  dy="0.355em"
                  textAnchor="start"
                  fill="var(--muted-foreground)"
                  fontSize="var(--tracker-text-size)"
                >
                  {Math.round(Number(payload.value) / axisUnit).toLocaleString("en-US")}
                  {activeChart === "time_worked" ? timeUnit.suffix : ""}
                </text>
              )}
            />

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
                <LiveActivityTooltip
                  {...props}
                  activeChart={activeChart}
                  activeStartTime={overview?.day.active_session?.start_time}
                  dataUpdatedAt={dataUpdatedAt}
                  data={data}
                  isPlaceholderData={isPlaceholderData}
                />
              )}
            />

            <ChartLegend content={<ChartLegendContent className="tracker-detail flex-wrap gap-x-4 gap-y-2" />} />

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
                  const cornerRadius = getBarCornerRadius(bar, maxCornerRadius);
                  const segments = bar.payload.segments;
                  const isTop = segments[index] > 0 &&
                    !segments.slice(index + 1).some(seconds => seconds > 0);
                  const isBottom = segments[index] > 0 &&
                    !segments.slice(0, index).some(seconds => seconds > 0);
                  return <Rectangle {...bar} radius={[
                    isTop ? cornerRadius : 0, isTop ? cornerRadius : 0,
                    isBottom ? cornerRadius : 0, isBottom ? cornerRadius : 0,
                  ]} />;
                }}
              />
            )) : (
              <Bar
                dataKey="session_count"
                fill="var(--color-session_count)"
                isAnimationActive={false}
                shape={(props: unknown) => {
                  const bar = props as RectangleProps;
                  return <Rectangle {...bar} radius={getBarCornerRadius(bar, maxCornerRadius)} />;
                }}
              />
            )}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export default DashboardActivityChart;
