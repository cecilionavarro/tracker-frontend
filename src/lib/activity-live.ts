import type { DashboardActivityResponse, Session } from "./api";

type Point = DashboardActivityResponse["points"][number];

// Older servers send named totals instead of category objects. Identify their
// active component from the session, never from whichever category has time.
export function normalizeActivityData(data: DashboardActivityResponse, session?: Session): DashboardActivityResponse {
  const latestDate = data.points.at(-1)?.date;
  return { ...data, points: data.points.map(point => {
    if (point.categories?.length) return point;
    const activeLabel = session?.category?.label.trim().toLowerCase();
    const activeTags = session?.tags.trim().toLowerCase().replace(/[ -]+/g, "_");
    const active = session?.is_active && !session.end_time && point.date === latestDate;
    const definitions = [
      { id: "creating", label: "Creating", tags: "", seconds: point.creating ?? 0 },
      { id: "toycon", label: "Toycon", tags: "", seconds: point.toycon ?? 0 },
      { id: "pianiso_technical", label: "Pianiso", tags: "technical", seconds: point.pianiso_technical ?? 0 },
      { id: "pianiso_non_technical", label: "Pianiso", tags: "non_technical", seconds: point.pianiso_non_technical ?? 0 },
    ];
    return { ...point, categories: definitions.map(category => ({
      ...category, color: null,
      is_active: Boolean(active && category.label.toLowerCase() === activeLabel
        && (activeLabel !== "pianiso" || category.tags === activeTags)),
    })).filter(category => category.seconds > 0 || category.is_active) };
  }) };
}

export function advanceActivityPoint(point: Point, deltaSeconds: number): Point {
  if (!point.categories?.some(category => category.is_active)) return point;
  const delta = Math.max(0, deltaSeconds);
  return {
    ...point,
    time_worked: point.time_worked + delta,
    categories: point.categories.map(category => ({
      ...category, seconds: category.seconds + (category.is_active ? delta : 0),
    })),
  };
}
