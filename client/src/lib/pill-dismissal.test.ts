import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DISMISSED_DATE_KEY,
  getTodayStr,
  isDismissedForDate,
  recordDismissal,
} from "./pill-dismissal";

function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

describe("pill dismissal date scoping", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is dismissed only for the stored date", () => {
    const storage = makeStorage();
    storage.setItem(DISMISSED_DATE_KEY, "2026-08-23");
    expect(isDismissedForDate("2026-08-23", storage)).toBe(true);
    // Next day: not dismissed
    expect(isDismissedForDate("2026-08-24", storage)).toBe(false);
  });

  it("is not dismissed when nothing is stored", () => {
    expect(isDismissedForDate("2026-08-24", makeStorage())).toBe(false);
  });

  it("records the click date and applies dismissal on the same day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 15, 0, 0));
    const storage = makeStorage();
    const clickDate = getTodayStr();
    // Animation delay passes, still the same day
    vi.advanceTimersByTime(200);
    const applies = recordDismissal(clickDate, new Date(), storage);
    expect(applies).toBe(true);
    expect(storage.getItem(DISMISSED_DATE_KEY)).toBe("2026-08-24");
    expect(isDismissedForDate(getTodayStr(), storage)).toBe(true);
  });

  it("dismissal clicked just before midnight does not suppress the next day's pill", () => {
    vi.useFakeTimers();
    // 100ms before midnight
    vi.setSystemTime(new Date(2026, 7, 24, 23, 59, 59, 900));
    const storage = makeStorage();
    const clickDate = getTodayStr();
    expect(clickDate).toBe("2026-08-24");

    // The 200ms dismiss animation crosses midnight
    vi.advanceTimersByTime(200);
    const applies = recordDismissal(clickDate, new Date(), storage);

    // Stored date is the click day, not the new day
    expect(storage.getItem(DISMISSED_DATE_KEY)).toBe("2026-08-24");
    // Dismissal no longer applies — it's a new day now
    expect(applies).toBe(false);
    // And the new day is not considered dismissed
    expect(isDismissedForDate(getTodayStr(), storage)).toBe(false);
  });

  it("day rollover re-evaluation: dismissed today, shown tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 12, 0, 0));
    const storage = makeStorage();
    recordDismissal(getTodayStr(), new Date(), storage);
    expect(isDismissedForDate(getTodayStr(), storage)).toBe(true);

    // App stays open past midnight
    vi.setSystemTime(new Date(2026, 7, 25, 0, 1, 0));
    expect(getTodayStr()).toBe("2026-08-25");
    expect(isDismissedForDate(getTodayStr(), storage)).toBe(false);
  });
});
