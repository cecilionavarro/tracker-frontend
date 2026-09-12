import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import ts from "typescript";

// Compile just the transport; tests need no DOM package or real network access.
const source = readFileSync(new URL("../src/lib/dashboard-socket.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
});
const { connectDashboardSocket } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

let timers, now, nextId, sockets, stop;
const original = { window: globalThis.window, document: globalThis.document, WebSocket: globalThis.WebSocket };

function start(...args) {
  const cleanup = connectDashboardSocket(...args);
  advance(0);
  return cleanup;
}

function advance(milliseconds) {
  const until = now + milliseconds;
  while (true) {
    const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next || next[1].at > until) break;
    now = next[1].at;
    timers.delete(next[0]);
    next[1].callback();
  }
  now = until;
}

beforeEach(() => {
  timers = new Map(); now = 0; nextId = 0; sockets = [];
  globalThis.window = Object.assign(new EventTarget(), {
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  globalThis.WebSocket = class {
    static OPEN = 1;
    readyState = 0;
    sent = [];
    constructor(url) { this.url = url; sockets.push(this); }
    open() { this.readyState = 1; this.onopen?.(); }
    message(type) { this.onmessage?.({ data: JSON.stringify({ type }) }); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; this.onclose?.(); }
  };
});

afterEach(() => {
  stop?.(); stop = undefined;
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete globalThis[name];
    else globalThis[name] = value;
  }
});

test("receives state and refreshes again after a closed connection recovers", () => {
  let refreshes = 0;
  const messages = [];
  stop = start("wss://tracker.test/api/v1/ws/dashboard/", e => messages.push(e.data), () => refreshes++);
  sockets[0].open(); sockets[0].message("status_update");
  sockets[0].close(); advance(1_000);
  assert.equal(sockets.length, 2);
  sockets[1].open(); sockets[1].message("state_update");
  assert.equal(refreshes, 2);
  assert.equal(messages.length, 2);
});

test("hung handshakes retry with backoff and refresh by HTTP while unavailable", () => {
  let refreshes = 0;
  stop = start("wss://tracker.test", () => {}, () => refreshes++);
  advance(10_000);
  assert.equal(sockets[0].readyState, 3);
  assert.equal(refreshes, 2);
  advance(1_000); assert.equal(sockets.length, 2);
  advance(10_000); advance(1_999); assert.equal(sockets.length, 2);
  advance(1); assert.equal(sockets.length, 3);
});

test("an apparently open but silent socket reconnects after its heartbeat deadline", () => {
  stop = start("wss://tracker.test", () => {}, () => {});
  sockets[0].open(); sockets[0].message("status_update");
  advance(25_000);
  assert.equal(sockets[0].sent.at(-1).type, "ping");
  advance(10_000); advance(1_000);
  assert.equal(sockets.length, 2);
});

test("healthy heartbeat replies stop fallback requests", () => {
  let refreshes = 0;
  stop = start("wss://tracker.test", () => {}, () => refreshes++);
  sockets[0].open(); sockets[0].message("pong");
  advance(25_000); sockets[0].message("pong"); advance(10_000);
  assert.equal(sockets.length, 1);
  assert.equal(refreshes, 1);
});

test("background pauses connections; visibility and page restore resume without duplicates", () => {
  stop = start("wss://tracker.test", () => {}, () => {});
  sockets[0].open(); sockets[0].message("pong");
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  advance(60_000); assert.equal(sockets.length, 1); assert.equal(timers.size, 0);
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));
  assert.equal(sockets.length, 2);
  window.dispatchEvent(new Event("pagehide"));
  window.dispatchEvent(new Event("pageshow"));
  assert.equal(sockets.length, 3);
});

test("online reconnects immediately and cleanup prevents future retries", () => {
  stop = start("wss://tracker.test", () => {}, () => {});
  sockets[0].close(); window.dispatchEvent(new Event("online"));
  assert.equal(sockets.length, 2);
  stop(); advance(60_000); window.dispatchEvent(new Event("focus"));
  assert.equal(sockets.length, 2); assert.equal(timers.size, 0);
});

test("Strict Mode setup/cleanup/setup opens only the surviving connection", () => {
  const discard = connectDashboardSocket("wss://tracker.test", () => {}, () => {});
  discard();
  stop = connectDashboardSocket("wss://tracker.test", () => {}, () => {});
  advance(0);
  assert.equal(sockets.length, 1);
});
