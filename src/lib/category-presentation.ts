// Shared by the session table and dashboard tooltip.
const COLORS: Record<string, string> = {
  creating: "#eab308",
  toycon: "#22c55e",
  pianiso_technical: "#ef4444",
  pianiso_non_technical: "#f97316",
};

export function normalizeTag(tags: string) {
  return tags.trim().toLowerCase().replace(/[ -]+/g, "_");
}

export function getCategoryColor(category: { label: string; color?: string | null }, tags = "") {
  const label = category.label.trim().toLowerCase();
  const tag = normalizeTag(tags);
  if (label === "pianiso") {
    if (tag.includes("non_technical")) return COLORS.pianiso_non_technical;
    if (tag.includes("technical")) return COLORS.pianiso_technical;
  }
  return COLORS[label] ?? category.color ?? "#999999";
}

export function getComponentLabel(category: { label: string }, tags = "") {
  const tag = normalizeTag(tags);
  return tag ? `${category.label} · ${tag.replace(/_/g, " ")}` : category.label;
}
