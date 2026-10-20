import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  effectiveDateFilter, emptySearchHeading, initialSearchInput,
  isSearchTileAvailable, matchesSearchDate, parseSearchInput,
} from "./parking-search"
import { setConfiguredTimezone } from "./timezone"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-21T04:30:00Z"))
  setConfiguredTimezone("America/Los_Angeles")
})
afterEach(() => vi.useRealTimers())

it("reinterprets search defaults, buttons, headings and tile rejection after a timezone change", () => {
  const input = initialSearchInput(390)
  const pacific = parseSearchInput(input, true)
  expect(pacific.date).toBe("2026-10-20")
  setConfiguredTimezone("America/New_York")
  const eastern = parseSearchInput(input, true)
  expect(eastern.date).toBe("2026-10-21")
  expect(effectiveDateFilter(eastern)).toBe("today")
  expect(emptySearchHeading(eastern, true)).toBe("No spots found for today")
  expect(effectiveDateFilter(pacific)).toBeUndefined()
  const tiles = ["2026-10-20", "2026-10-21", "2026-10-22"].map(date => ({
    availability: { date }, isAvailable: true, isBookable: true,
  }))
  expect(tiles.filter(spot => isSearchTileAvailable(spot, true))
    .filter(spot => matchesSearchDate(spot.availability.date, eastern))
    .map(spot => spot.availability.date)).toEqual(["2026-10-21"])
  expect(parseSearchInput({ query: "tomorrow", quickFilters: [] }, false).date).toBe("2026-10-22")
})
