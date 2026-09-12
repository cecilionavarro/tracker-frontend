const CONNECT_TIMEOUT = 10_000;
const HEARTBEAT_INTERVAL = 25_000;
const HEARTBEAT_TIMEOUT = 10_000;

// Owns one connection and its timers. React cleanup also cancels retries.
export function connectDashboardSocket(
  url: string,
  onMessage: (event: MessageEvent) => void,
  refresh: () => void,
) {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retryDelay = 1_000;
  let retryTimer: number | undefined;
  let heartbeatTimer: number | undefined;
  let deadlineTimer: number | undefined;
  let fallbackTimer: number | undefined;

  function startFallback() {
    if (fallbackTimer !== undefined) return;
    fallbackTimer = window.setTimeout(() => {
      fallbackTimer = undefined;
      refresh();
      startFallback();
    }, 5_000);
  }

  function disconnect() {
    window.clearTimeout(heartbeatTimer);
    window.clearTimeout(deadlineTimer);
    heartbeatTimer = deadlineTimer = undefined;
    if (socket) {
      socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;
      socket.close();
      socket = null;
    }
  }

  function retry() {
    disconnect();
    if (stopped || document.visibilityState === "hidden" || retryTimer !== undefined) return;
    startFallback();
    retryTimer = window.setTimeout(() => {
      retryTimer = undefined;
      connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30_000);
  }

  function ping() {
    if (socket?.readyState !== WebSocket.OPEN || deadlineTimer !== undefined) return;
    window.clearTimeout(heartbeatTimer);
    // Detect connections that appear OPEN after sleep but no longer carry traffic.
    deadlineTimer = window.setTimeout(retry, HEARTBEAT_TIMEOUT);
    try {
      socket.send(JSON.stringify({ type: "ping" }));
    } catch {
      retry();
    }
  }

  function connect() {
    if (stopped || socket || document.visibilityState === "hidden") return;
    startFallback();
    try {
      socket = new WebSocket(url);
    } catch {
      retry();
      return;
    }
    deadlineTimer = window.setTimeout(retry, CONNECT_TIMEOUT);
    socket.onopen = () => {
      window.clearTimeout(deadlineTimer);
      deadlineTimer = undefined;
      refresh(); // Recover updates missed while disconnected.
      ping();
    };
    socket.onmessage = (event) => {
      retryDelay = 1_000;
      window.clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
      window.clearTimeout(deadlineTimer);
      deadlineTimer = undefined;
      window.clearTimeout(heartbeatTimer);
      heartbeatTimer = window.setTimeout(ping, HEARTBEAT_INTERVAL);
      onMessage(event);
    };
    socket.onclose = retry;
    socket.onerror = retry;
  }

  function suspend() {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = undefined;
    window.clearTimeout(retryTimer);
    retryTimer = undefined;
    disconnect();
  }

  function resume() {
    if (stopped || document.visibilityState === "hidden") return;
    refresh();
    window.clearTimeout(retryTimer);
    retryTimer = undefined;
    if (socket?.readyState === WebSocket.OPEN) ping();
    else if (!socket) connect();
  }

  function visibilityChanged() {
    if (document.visibilityState === "hidden") suspend();
    else resume();
  }

  document.addEventListener("visibilitychange", visibilityChanged);
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  window.addEventListener("online", resume);
  window.addEventListener("focus", resume);
  // React Strict Mode runs setup/cleanup/setup in development. Defer the first
  // handshake so the throwaway setup is cancelled before opening a connection.
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined;
    connect();
  }, 0);

  return () => {
    stopped = true;
    suspend();
    document.removeEventListener("visibilitychange", visibilityChanged);
    window.removeEventListener("pagehide", suspend);
    window.removeEventListener("pageshow", resume);
    window.removeEventListener("online", resume);
    window.removeEventListener("focus", resume);
  };
}
