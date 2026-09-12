const dateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric",
});
const shortDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric",
});

// The API's week is Monday–Sunday in Los Angeles. Use calendar arithmetic in
// UTC so the viewer's timezone and daylight-saving changes cannot shift dates.
export function getWeekDateLabels(snapshotAt: number) {
  const parts = Object.fromEntries(dateParts.formatToParts(snapshotAt).map(part => [part.type, part.value]));
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(day);
    date.setUTCDate(day.getUTCDate() + index);
    return shortDate.format(date);
  });
}
