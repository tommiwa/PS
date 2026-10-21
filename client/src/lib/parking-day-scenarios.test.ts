import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { canCancelBooking } from "../../../shared/booking-cancellation";
import { createLiveClock } from "./live-clock";
import { setConfiguredTimezone } from "./timezone";
import {
  effectiveDateFilter, initialSearchInput, isSearchTileAvailable, matchesSearchDate, parseSearchInput,
} from "./parking-search";

const hostTimezone = process.env.TZ;
beforeEach(() => {
  vi.useFakeTimers();
  setConfiguredTimezone("America/Vancouver");
});
afterEach(() => {
  vi.useRealTimers();
  if (hostTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = hostTimezone;
});

// Exercise the actual base-availability + daily-date-filter pipeline, including
// multi-day parent listings, not just an isolated date formatter.
function visibleDays(mobile: boolean, days: string[], query = "") {
  const input = mobile ? initialSearchInput(390) : { query: "", quickFilters: ["today"] };
  const criteria = parseSearchInput({ ...input, query }, mobile);
  const tiles = days.map(date => ({
    availability: { date }, availabilityDates: days, isAvailable: true, isBookable: true,
  }));
  return tiles.filter(tile => isSearchTileAvailable(tile, mobile))
    .filter(tile => matchesSearchDate(tile.availability.date, criteria))
    .map(tile => tile.availability.date);
}

describe.each(["UTC", "America/Vancouver", "Asia/Tokyo", "Pacific/Auckland"])("device timezone %s", device => {
  it.each([
    ["2026-05-13T06:59:59.999Z", "2026-05-12", "2026-05-13"],
    ["2026-05-13T07:00:00.000Z", "2026-05-13", "2026-05-14"],
    ["2026-01-01T07:59:59.999Z", "2025-12-31", "2026-01-01"],
    ["2026-01-01T08:00:00.000Z", "2026-01-01", "2026-01-02"],
    ["2024-03-01T07:59:59.999Z", "2024-02-29", "2024-03-01"],
    ["2025-03-09T09:59:59Z", "2025-03-09", "2025-03-10"],
    ["2025-03-09T10:00:00Z", "2025-03-09", "2025-03-10"],
    ["2025-11-02T08:59:59Z", "2025-11-02", "2025-11-03"],
    ["2025-11-02T09:00:00Z", "2025-11-02", "2025-11-03"],
  ])("Today never leaks tomorrow at %s", (instant, today, tomorrow) => {
    process.env.TZ = device;
    vi.setSystemTime(new Date(instant));
    for (const mobile of [true, false]) {
      expect(visibleDays(mobile, ["2024-01-01", today, tomorrow, "2027-01-01"])).toEqual([today]);
      expect(visibleDays(mobile, [tomorrow])).toEqual([]);
      expect(visibleDays(mobile, [today, tomorrow], "tomorrow")).toEqual([tomorrow]);
    }
  });
});

it("excludes undated, booked, and non-bookable tiles under Today", () => {
  vi.setSystemTime(new Date("2026-05-12T18:00:00Z"));
  const criteria = parseSearchInput(initialSearchInput(390), true);
  const tiles = [
    { isAvailable: true, isBookable: true },
    { availability: { date: "2026-05-12" }, isAvailable: false, isBookable: true },
    { availability: { date: "2026-05-12" }, isAvailable: true, isBookable: false },
  ];
  expect(tiles.filter(tile => isSearchTileAvailable(tile, true))
    .filter(tile => matchesSearchDate(tile.availability?.date, criteria))).toEqual([]);
});

it("updates an open Today filter at BC midnight without changing the saved filter", () => {
  vi.setSystemTime(new Date("2026-05-13T06:59:59Z"));
  const clock = createLiveClock();
  const input = initialSearchInput(390);
  const observed: string[][] = [];
  const stop = clock.subscribe(() => {
    observed.push(visibleDays(true, ["2026-05-12", "2026-05-13", "2026-05-14"]));
    expect(effectiveDateFilter(parseSearchInput(input, true))).toBe("today");
  });
  expect(observed.at(-1)).toEqual(["2026-05-12"]);
  vi.advanceTimersByTime(1000);
  expect(observed.at(-1)).toEqual(["2026-05-13"]);
  expect(input.quickFilters).toEqual(["today"]);
  stop();
});

it("refreshes cutoff eligibility on an open page", () => {
  vi.setSystemTime(new Date("2026-05-12T18:59:59Z"));
  const clock = createLiveClock();
  let allowed = false;
  const stop = clock.subscribe(() => {
    allowed = canCancelBooking("2026-05-13", "America/Vancouver", 12, new Date(clock.getSnapshot()));
  });
  expect(allowed).toBe(true);
  vi.advanceTimersByTime(1000);
  expect(allowed).toBe(true); // inclusive cutoff
  vi.advanceTimersByTime(1000);
  expect(allowed).toBe(false);
  stop();
});

it("wires live day/cutoff subscriptions into the actual search and both renter layouts", () => {
  const search = readFileSync("client/src/hooks/use-parking-search.ts", "utf8");
  expect(search).toContain("const parkingDay = useParkingDay()");
  expect(search).toContain("[applied, weekStartDay, timezone, parkingDay]");
  const bookings = readFileSync("client/src/pages/my-bookings.tsx", "utf8");
  expect(bookings).toContain("const now = useCurrentTime()");
  expect(bookings).not.toContain("new Date().toISOString().split('T')[0]");
  for (const start of ["const renderRenterBooking =", "const renderRenterBookingCompact ="]) {
    const renderer = bookings.slice(bookings.indexOf(start), bookings.indexOf(start) + 2200);
    expect(renderer).toContain("const today = parkingDay");
    expect(renderer).toContain("cancellationWindowHours, new Date(now)");
    expect(renderer).toContain("!isCancelled && !isCompleted");
  }
});
