/**
 * One shared clock for time-sensitive UI. Refresh on resume too: browsers can
 * suspend timers while a PWA is backgrounded. No timer runs without subscribers.
 */
export function createLiveClock() {
  const listeners = new Set<() => void>();
  let now = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    clearTimeout(timer);
    now = Date.now();
    listeners.forEach(listener => listener());
    if (listeners.size) timer = setTimeout(refresh, 1000 - (now % 1000));
  };
  return {
    getSnapshot: () => now,
    subscribe(listener: () => void) {
      if (!listeners.size) {
        now = Date.now();
        if (typeof window !== "undefined") window.addEventListener("focus", refresh);
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", refresh);
      }
      listeners.add(listener);
      if (listeners.size === 1) refresh();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearTimeout(timer);
          if (typeof window !== "undefined") window.removeEventListener("focus", refresh);
          if (typeof document !== "undefined") document.removeEventListener("visibilitychange", refresh);
        }
      };
    },
  };
}

export const liveClock = createLiveClock();
