import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

async function load(name) {
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { createDashboardClock } = await load("dashboard-clock");
const { createDashboardRefresher } = await load("dashboard-refresh");
const { normalizeActivityData, advanceActivityPoint } = await load("activity-live");
const { getWeekDateLabels } = await load("dashboard-date");

test("legacy activity increments only the active day/category and never accumulates twice", () => {
  const response = { days: 2, points: [
    { date: "2026-09-10", time_worked: 600, creating: 600, session_count: 1 },
    { date: "2026-09-11", time_worked: 1200, creating: 900, pianiso_technical: 300, session_count: 2 },
  ] };
  const session = { is_active: true, end_time: null, category: { label: "Creating" }, tags: "" };
  const normalized = normalizeActivityData(response, session);
  assert.equal(advanceActivityPoint(normalized.points[0], 10), normalized.points[0]);
  for (let elapsed = 1; elapsed <= 20; elapsed++) {
    const point = advanceActivityPoint(normalized.points[1], elapsed);
    assert.equal(point.time_worked, 1200 + elapsed);
    assert.equal(point.categories.find(category => category.id === "creating").seconds, 900 + elapsed);
    assert.equal(point.categories.find(category => category.id === "pianiso_technical").seconds, 300);
  }
  assert.equal(response.points[1].time_worked, 1200);
  const stopped = normalizeActivityData(response, { ...session, is_active: false, end_time: "2026-09-12T02:00:00Z" });
  assert.equal(advanceActivityPoint(stopped.points[1], 100).time_worked, 1200);
});

test("modern category metadata and zero-second active categories remain live", () => {
  const point = { date: "2026-09-11", time_worked: 0, session_count: 1,
    categories: [{ id: "custom", label: "Custom", color: "#123456", seconds: 0, is_active: true }] };
  const normalized = normalizeActivityData({ days: 1, points: [point] });
  assert.equal(normalized.points[0], point);
  assert.equal(advanceActivityPoint(point, 1).categories[0].seconds, 1);
});

test("week labels include short weekday, month, day and year in the API timezone", () => {
  const labels = getWeekDateLabels(Date.parse("2026-09-12T01:30:00Z"));
  assert.equal(labels[0], "Mon, Sep 7, 2026");
  assert.equal(labels[4], "Fri, Sep 11, 2026");
  assert.equal(labels[6], "Sun, Sep 13, 2026");
  assert.equal(getWeekDateLabels(Date.parse("2026-01-01T12:00:00Z"))[0], "Mon, Dec 29, 2025");
  assert.equal(getWeekDateLabels(Date.parse("2026-03-08T12:00:00Z"))[6], "Sun, Mar 8, 2026");
});

function environment(t) {
  const intervals = new Map(), timeouts = new Map(), listeners = new Set();
  let id = 0;
  t.mock.method(Date, "now", () => 1_000);
  const savedWindow = globalThis.window, savedDocument = globalThis.document;
  globalThis.window = {
    setInterval(fn) { intervals.set(++id, fn); return id; },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(fn) { timeouts.set(++id, fn); return id; },
    clearTimeout(id) { timeouts.delete(id); },
  };
  globalThis.document = {
    visibilityState: "visible",
    addEventListener(_, fn) { listeners.add(fn); },
    removeEventListener(_, fn) { listeners.delete(fn); },
  };
  t.after(() => {
    if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow;
    if (savedDocument === undefined) delete globalThis.document; else globalThis.document = savedDocument;
  });
  return {
    intervals, timeouts, listeners,
    flush() { for (const [id, fn] of [...timeouts]) { timeouts.delete(id); fn(); } },
    visible(value) { document.visibilityState = value ? "visible" : "hidden"; listeners.forEach(fn => fn()); },
  };
}

test("100 live subscribers share one timer and catch up after a hidden tab", t => {
  const env = environment(t);
  const clock = createDashboardClock();
  let calls = 0;
  const unsubscribe = Array.from({ length: 100 }, () => clock.subscribe(() => calls++));
  assert.equal(env.intervals.size, 1);
  assert.equal(env.listeners.size, 1);
  calls = 0;
  Date.now.mock.mockImplementation(() => 2_000);
  [...env.intervals.values()][0]();
  assert.equal(calls, 100); assert.equal(clock.getSnapshot(), 2_000);
  env.visible(false); assert.equal(env.intervals.size, 0);
  Date.now.mock.mockImplementation(() => 60_000);
  env.visible(true);
  assert.equal(clock.getSnapshot(), 60_000); assert.equal(env.intervals.size, 1);
  unsubscribe.forEach(fn => fn());
  assert.equal(env.intervals.size, 0); assert.equal(env.listeners.size, 0);
});

test("10,000 mount/unmount cycles leave no clock timers or event handlers", t => {
  const env = environment(t);
  const clock = createDashboardClock();
  for (let i = 0; i < 10_000; i++) clock.subscribe(() => {})();
  assert.equal(env.intervals.size, 0); assert.equal(env.listeners.size, 0);
  env.visible(false);
  const unsubscribe = clock.subscribe(() => {});
  assert.equal(env.intervals.size, 0);
  unsubscribe(); assert.equal(env.listeners.size, 0);
});

test("chart snapshots change six times per minute while counters stay live", t => {
  const env = environment(t);
  const clock = createDashboardClock();
  let text = clock.getSnapshot(), chart = clock.getSnapshot(10_000);
  let textUpdates = 0, chartUpdates = 0;
  const unsubscribe = clock.subscribe(() => {
    const nextText = clock.getSnapshot(), nextChart = clock.getSnapshot(10_000);
    if (nextText !== text) textUpdates++;
    if (nextChart !== chart) chartUpdates++;
    text = nextText; chart = nextChart;
  });
  for (let seconds = 2; seconds <= 61; seconds++) {
    Date.now.mock.mockImplementation(() => seconds * 1_000);
    [...env.intervals.values()][0]();
  }
  assert.equal(textUpdates, 60);
  assert.equal(chartUpdates, 6);
  assert.equal(env.intervals.size, 1);
  env.visible(false);
  Date.now.mock.mockImplementation(() => 123_456);
  env.visible(true);
  assert.equal(clock.getSnapshot(), 123_456);
  assert.equal(clock.getSnapshot(10_000), 120_000);
  unsubscribe();
  assert.equal(env.intervals.size, 0);
});

test("bursts coalesce and slow requests get only one necessary follow-up", async t => {
  const env = environment(t);
  const resolvers = [];
  let calls = 0;
  const refresher = createDashboardRefresher(() => {
    calls++; return new Promise(resolve => resolvers.push(resolve));
  });
  for (let i = 0; i < 20; i++) refresher.request();
  assert.equal(env.timeouts.size, 1);
  env.flush(); assert.equal(calls, 1);
  for (let i = 0; i < 20; i++) refresher.request();
  assert.equal(env.timeouts.size, 0);
  refresher.request(true); refresher.request(true);
  resolvers.shift()(); await Promise.resolve(); await Promise.resolve();
  assert.equal(env.timeouts.size, 1);
  env.flush(); assert.equal(calls, 2);
  resolvers.shift()(); await Promise.resolve(); await Promise.resolve();
  assert.equal(env.timeouts.size, 0);
  refresher.stop();
});

test("cleanup cancels queued refreshes including work after an in-flight request", async t => {
  const env = environment(t);
  let resolve;
  const refresher = createDashboardRefresher(() => new Promise(done => { resolve = done; }));
  refresher.request(); env.flush(); refresher.request(true); refresher.stop();
  resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(env.timeouts.size, 0);
  refresher.request(); assert.equal(env.timeouts.size, 0);
});
