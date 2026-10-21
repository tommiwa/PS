import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveClock } from "./live-clock";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T06:59:59Z"));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("live parking clock", () => {
  it("notifies at midnight, shares one timer, and cleans up after the last subscriber", () => {
    const clock = createLiveClock();
    const listener = vi.fn();
    const stopA = clock.subscribe(listener);
    const stopB = clock.subscribe(vi.fn());
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(clock.getSnapshot()).toBe(Date.parse("2026-10-21T07:00:00Z"));
    expect(listener).toHaveBeenCalledTimes(2);
    stopA();
    expect(vi.getTimerCount()).toBe(1);
    stopB();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refreshes immediately after a suspended tab/PWA resumes and removes listeners", () => {
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget();
    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", documentTarget);
    const clock = createLiveClock();
    const changed = vi.fn();
    const stop = clock.subscribe(changed);
    vi.setSystemTime(new Date("2026-10-22T07:00:01Z"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(clock.getSnapshot()).toBe(Date.now());
    vi.setSystemTime(new Date("2026-10-23T07:00:01Z"));
    windowTarget.dispatchEvent(new Event("focus"));
    expect(clock.getSnapshot()).toBe(Date.now());
    stop();
    changed.mockClear();
    windowTarget.dispatchEvent(new Event("focus"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(changed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
