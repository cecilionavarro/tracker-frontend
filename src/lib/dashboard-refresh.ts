// Group focus/open/status events into one request batch. A real state change
// during a slow request queues one follow-up; maintenance refreshes just reuse it.
export function createDashboardRefresher(fetchData: () => Promise<unknown>) {
  let timer: number | undefined;
  let running = false;
  let changedWhileRunning = false;
  let stopped = false;

  function request(stateChanged = false) {
    if (stopped) return;
    if (running) {
      changedWhileRunning ||= stateChanged;
      return;
    }
    if (timer !== undefined) return;
    timer = window.setTimeout(() => {
      timer = undefined;
      running = true;
      void fetchData().catch(() => {
        // Query state owns error display and retry behavior.
      }).finally(() => {
        running = false;
        if (changedWhileRunning) {
          changedWhileRunning = false;
          request();
        }
      });
    }, 50);
  }

  return {
    request,
    stop() {
      stopped = true;
      window.clearTimeout(timer);
      timer = undefined;
    },
  };
}
