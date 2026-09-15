/**
 * Minimal client-side cold-load timing.
 *
 * Reports a handful of Navigation Timing / Paint Timing numbers back to the
 * server so real before/after load-time numbers are visible in server logs,
 * instead of relying on a subjective "feels faster". No third-party RUM
 * service — just one small beacon per page load.
 */

interface ClientLoadMetrics {
  path: string;
  standalone: boolean; // installed PWA (home screen) vs. browser tab
  connection: string | null; // e.g. "4g", "3g" — navigator.connection.effectiveType
  ttfbMs: number | null; // time to first byte (server response start)
  domContentLoadedMs: number | null; // DOM parsed, no need to wait on images/fonts
  firstPaintMs: number | null;
  firstContentfulPaintMs: number | null;
  loadEventMs: number | null; // full window 'load' event (all resources done)
  transferKb: number | null; // total bytes transferred for this navigation's resources
}

function collectMetrics(): ClientLoadMetrics | null {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!nav) return null;

  const paintEntries = performance.getEntriesByType("paint");
  const firstPaint = paintEntries.find((e) => e.name === "first-paint");
  const firstContentfulPaint = paintEntries.find((e) => e.name === "first-contentful-paint");

  const resourceBytes = performance
    .getEntriesByType("resource")
    .reduce((sum, entry: any) => sum + (entry.transferSize || 0), 0);

  const connection = (navigator as any).connection?.effectiveType ?? null;

  return {
    path: location.pathname,
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true,
    connection,
    ttfbMs: Math.round(nav.responseStart),
    domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
    firstPaintMs: firstPaint ? Math.round(firstPaint.startTime) : null,
    firstContentfulPaintMs: firstContentfulPaint ? Math.round(firstContentfulPaint.startTime) : null,
    loadEventMs: Math.round(nav.loadEventEnd),
    transferKb: Math.round(resourceBytes / 1024),
  };
}

function sendMetrics(metrics: ClientLoadMetrics) {
  const body = JSON.stringify(metrics);
  const url = "/api/client-metrics";

  try {
    if (navigator.sendBeacon) {
      // Content-Type must be application/json for the server to parse it;
      // sendBeacon defaults to text/plain, so we set it explicitly via Blob.
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    // fall through to fetch
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Call once on app startup. Waits for the window 'load' event (so
 * loadEventEnd/transfer totals are populated), then reports metrics.
 */
export function reportColdLoadMetrics() {
  const report = () => {
    const metrics = collectMetrics();
    if (metrics) sendMetrics(metrics);
  };

  if (document.readyState === "complete") {
    // Already loaded (e.g. fast reload) — report on next idle tick.
    setTimeout(report, 0);
  } else {
    window.addEventListener("load", () => setTimeout(report, 0), { once: true });
  }
}
