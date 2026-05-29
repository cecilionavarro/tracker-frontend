// src/lib/time.ts
export function getActiveDurationSeconds(
  startIso: string,
  endIso: string | null,
  nowMs: number
): number | null {
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return null;

  const endMs = endIso ? Date.parse(endIso) : nowMs;
  if (Number.isNaN(endMs)) return null;

  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}
