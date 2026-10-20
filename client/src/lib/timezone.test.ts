import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type * as Timezone from "./timezone";

let timezone: typeof Timezone;
const response = (value: string) => new Response(JSON.stringify({ key: "timezone", value }));

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T04:30:00Z"));
  timezone = await import("./timezone");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("initialized shared timezone source", () => {
  it("does not guess a synchronous date before initialization", () => {
    expect(() => timezone.getTodayInTimezoneSync()).toThrow("has not loaded");
  });

  it("deduplicates initialization and uses the actual authenticated config endpoint", async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    const first = timezone.getConfiguredTimezone();
    const second = timezone.getConfiguredTimezone();
    expect(() => timezone.getTodayInTimezoneSync()).toThrow();
    resolve(response("America/New_York"));
    expect(await first).toBe("America/New_York");
    expect(await second).toBe("America/New_York");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/app-configs/timezone", expect.objectContaining({
      credentials: "include", cache: "no-store",
    }));
    expect(timezone.getTodayInTimezoneSync()).toBe("2026-10-21");
    expect(await timezone.getTodayInTimezone()).toBe("2026-10-21");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([401, 500])("blocks initialization on HTTP %s instead of assuming Pacific", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    await expect(timezone.getConfiguredTimezone()).rejects.toThrow("Unable to load");
    expect(() => timezone.getConfiguredTimezoneSync()).toThrow();
  });

  it("can retry a network failure without caching an incorrect default", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response("America/New_York")));
    await expect(timezone.getConfiguredTimezone()).rejects.toThrow("offline");
    expect(() => timezone.getConfiguredTimezoneSync()).toThrow();
    await timezone.getConfiguredTimezone();
    expect(timezone.getTodayInTimezoneSync()).toBe("2026-10-21");
  });

  it("uses the backend default only for a missing/empty setting", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(response("")));
    expect(await timezone.getConfiguredTimezone()).toBe("America/Los_Angeles");
    expect(await timezone.getConfiguredTimezone(true)).toBe("America/Los_Angeles");
  });

  it.each(["Not/A_Zone", "   "])("rejects invalid setting %s", async value => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(value)));
    await expect(timezone.getConfiguredTimezone()).rejects.toThrow();
    expect(() => timezone.getConfiguredTimezoneSync()).toThrow();
  });

  it("retains the verified source during expiry, refresh, and failed refresh", async () => {
    timezone.setConfiguredTimezone("America/New_York");
    vi.advanceTimersByTime(timezone.TIMEZONE_REFRESH_MS + 1);
    expect(timezone.getTodayInTimezoneSync()).toBe("2026-10-21");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response("America/Los_Angeles")));
    await expect(timezone.getConfiguredTimezone()).rejects.toThrow();
    expect(timezone.getConfiguredTimezoneSync()).toBe("America/New_York");
    await timezone.getConfiguredTimezone();
    expect(timezone.getTodayInTimezoneSync()).toBe("2026-10-20");
  });

  it("notifies mounted date calculations without losing subscriptions or overriding a newer admin save", async () => {
    timezone.setConfiguredTimezone("America/Los_Angeles");
    const listener = vi.fn();
    const unsubscribe = timezone.subscribeToTimezone(listener);
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(done => { resolve = done; })));
    const refresh = timezone.getConfiguredTimezone(true);
    timezone.setConfiguredTimezone("America/New_York");
    expect(listener).toHaveBeenCalledTimes(1);
    resolve(response("America/Los_Angeles"));
    expect(await refresh).toBe("America/New_York");
    unsubscribe();
    timezone.setConfiguredTimezone("UTC");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps date-only booking/storage values unchanged", async () => {
    timezone.setConfiguredTimezone("Pacific/Kiritimati");
    expect(await timezone.formatDateForDB("2026-10-20")).toBe("2026-10-20");
    expect(await timezone.formatDateInTimezone("2026-10-20")).toBe("10/20/2026");
    expect(await timezone.formatDateForDB("2026-10-21T11:30:00Z")).toBe("2026-10-22");
  });
});

describe("configured calendar arithmetic", () => {
  it.each([
    ["America/Los_Angeles", "2026-10-21T04:30:00Z", "2026-10-20", "2026-10-21", "2026-10-24", "2026-10-25"],
    ["America/New_York", "2026-10-21T04:30:00Z", "2026-10-21", "2026-10-22", "2026-10-24", "2026-10-25"],
    ["Pacific/Kiritimati", "2026-12-31T10:01:00Z", "2027-01-01", "2027-01-02", "2027-01-02", "2027-01-03"],
    ["America/New_York", "2026-03-08T04:30:00Z", "2026-03-07", "2026-03-08", "2026-03-07", "2026-03-08"],
    ["America/New_York", "2026-03-08T06:59:59Z", "2026-03-08", "2026-03-09", "2026-03-14", "2026-03-08"],
    ["America/New_York", "2026-03-08T07:00:00Z", "2026-03-08", "2026-03-09", "2026-03-14", "2026-03-08"],
    ["America/New_York", "2026-11-01T05:30:00Z", "2026-11-01", "2026-11-02", "2026-11-07", "2026-11-01"],
    ["America/New_York", "2026-11-01T06:30:00Z", "2026-11-01", "2026-11-02", "2026-11-07", "2026-11-01"],
    ["America/Los_Angeles", "2026-03-08T09:59:59Z", "2026-03-08", "2026-03-09", "2026-03-14", "2026-03-08"],
    ["America/Los_Angeles", "2026-03-08T10:00:00Z", "2026-03-08", "2026-03-09", "2026-03-14", "2026-03-08"],
    ["America/New_York", "2028-02-29T05:01:00Z", "2028-02-29", "2028-03-01", "2028-03-04", "2028-03-05"],
  ])("%s at %s", async (zone, instant, today, tomorrow, saturday, sunday) => {
    vi.setSystemTime(new Date(instant));
    timezone.setConfiguredTimezone(zone);
    expect(timezone.getTodayInTimezoneSync()).toBe(today);
    expect(await timezone.getTodayInTimezone()).toBe(today);
    expect(timezone.getTomorrowInTimezoneSync()).toBe(tomorrow);
    expect(timezone.getEndOfWeekInTimezoneSync()).toBe(saturday);
    expect(timezone.getEndOfWeekInTimezoneSync("monday")).toBe(sunday);
  });
});

it("gates protected UI and subscribes memoized search to timezone updates", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  expect(app).toContain("return <TimezoneGate><AuthenticatedApp /></TimezoneGate>");
  const gate = readFileSync(new URL("../components/timezone-gate.tsx", import.meta.url), "utf8");
  expect(gate.indexOf("if (!timezone.data)")).toBeLessThan(gate.indexOf("return <>{children}</>"));
  expect(gate).toContain("getConfiguredTimezone(true)");
  expect(gate).toContain("refetchInterval: TIMEZONE_REFRESH_MS");
  const hook = readFileSync(new URL("../hooks/use-parking-search.ts", import.meta.url), "utf8");
  expect(hook).toContain("useConfiguredTimezone()");
  expect(hook).toContain("[applied, weekStartDay, timezone]");
});
