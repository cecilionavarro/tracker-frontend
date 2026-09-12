// All live counters share one tick, regardless of the table's page size.
export function createDashboardClock() {
  const listeners = new Set<() => void>();
  let now = Date.now();
  let timer: number | undefined;

  function tick() {
    now = Date.now();
    listeners.forEach(listener => listener());
  }

  function stop() {
    window.clearInterval(timer);
    timer = undefined;
  }

  function visibilityChanged() {
    stop();
    if (document.visibilityState !== "hidden" && listeners.size) {
      tick(); // Catch up using wall-clock time, not the number of elapsed ticks.
      timer = window.setInterval(tick, 1_000);
    }
  }

  return {
    getSnapshot: (intervalMs = 1) => Math.floor(now / intervalMs) * intervalMs,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        document.addEventListener("visibilitychange", visibilityChanged);
        visibilityChanged();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stop();
          document.removeEventListener("visibilitychange", visibilityChanged);
        }
      };
    },
  };
}
