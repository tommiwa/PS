import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import {
  createSearchDebouncer, effectiveDateFilter, emptySearchHeading, initialSearchInput,
  isSearchTileAvailable, matchesSearchDate, matchesSearchText, parseSearchInput, toggleSearchFilter, withoutDateKeywords,
  type ParsedSearch, type SearchInput,
} from "./parking-search"
import { getTodayInTimezoneSync, getTomorrowInTimezoneSync, setConfiguredTimezone } from "./timezone"

beforeEach(() => {
  vi.useFakeTimers()
  // UTC has already crossed midnight, while the parking timezone is still Oct 20.
  vi.setSystemTime(new Date("2026-10-21T02:00:00Z"))
  setConfiguredTimezone("America/Los_Angeles")
})
afterEach(() => vi.useRealTimers())

const parse = (query = "", quickFilters: string[] = ["today"]) =>
  parseSearchInput({ query, quickFilters }, true)
const heading = (criteria: ParsedSearch) => emptySearchHeading(criteria, true)

describe("fresh search initialization", () => {
  it("defaults below 768px to Today with an immediately applied timezone date", () => {
    const initial = initialSearchInput(767)
    expect(initial).toEqual({ query: "", quickFilters: ["today"] })
    expect(parseSearchInput(initial, true).date).toBe("2026-10-20")
    expect(getTodayInTimezoneSync()).toBe("2026-10-20")
    expect(getTomorrowInTimezoneSync()).toBe("2026-10-21")
  })

  it("leaves desktop and server initial state unfiltered", () => {
    for (const width of [768, 1440, undefined]) {
      expect(parseSearchInput(initialSearchInput(width))).toEqual({ query: "", quickFilters: [] })
    }
  })

  it("creates independent fresh visits, not shared or persisted filters", () => {
    const visit = initialSearchInput(390)
    visit.quickFilters.length = 0
    expect(initialSearchInput(390).quickFilters).toEqual(["today"])
  })
})

describe("effective mobile date filters", () => {
  it("keeps Today, Tomorrow, and This Week mutually exclusive", () => {
    let input = initialSearchInput(390)
    for (const value of ["tomorrow", "this_week", "today"]) {
      input = toggleSearchFilter(input, value, true)
      expect(input.quickFilters).toEqual([value])
      const criteria = parseSearchInput(input, true)
      expect(effectiveDateFilter(criteria)).toBe(value)
      expect(heading(criteria)).toBe(`No spots found for ${value.replace("_", " ")}`)
      expect(!!criteria.date && !!criteria.dateRange).toBe(false)
    }
    input = toggleSearchFilter(input, "today", true)
    expect(parseSearchInput(input, true)).toEqual({ query: "", quickFilters: [] })
  })

  it("uses text keywords over stale quick-filter labels without intersecting dates and ranges", () => {
    const tomorrow = parse("tomorrow", ["this_week"])
    expect(tomorrow.date).toBe("2026-10-21")
    expect(tomorrow.dateRange).toBeUndefined()
    expect(effectiveDateFilter(tomorrow)).toBe("tomorrow")
    expect(heading(tomorrow)).toBe("No spots found for tomorrow")
    expect(heading(parse("today", ["tomorrow"]))).toBe("No spots found for today")
    const week = parse("this week")
    expect(week.date).toBeUndefined()
    expect(week.dateRange).toEqual({ start: "2026-10-20", end: "2026-10-24" })
    expect(heading(week)).toBe("No spots found for this week")
  })

  it("allows date buttons to replace keywords while preserving other search filters", () => {
    const input = toggleSearchFilter({ query: "tomorrow electric", quickFilters: ["today", "electric"] }, "this_week", true)
    expect(input).toEqual({ query: "electric", quickFilters: ["electric", "this_week"] })
    const criteria = parseSearchInput(input, true)
    expect(criteria.spotType).toBe("electric")
    expect(criteria.date).toBeUndefined()
    expect(heading(criteria)).toBe("No spots found for this week")
    expect(toggleSearchFilter({ query: "tomorrow electric", quickFilters: ["today", "electric"] }, "tomorrow", true))
      .toEqual({ query: "electric", quickFilters: ["electric"] })
  })

  it("removes only date keywords from mobile literal matching", () => {
    expect(withoutDateKeywords("tomorrow electric")).toBe("electric")
    expect(withoutDateKeywords("TODAY")).toBe("")
    expect(withoutDateKeywords("this week charity")).toBe("charity")
    expect(withoutDateKeywords("tomorrowland monday")).toBe("tomorrowland monday")
  })

  it("honors the configured end of week and late configuration loading", () => {
    const input = { query: "", quickFilters: ["this_week"] }
    const monday = parseSearchInput(input, true, "monday")
    expect(monday.dateRange).toEqual({ start: "2026-10-20", end: "2026-10-25" })
    expect(emptySearchHeading(monday, true, "monday")).toBe("No spots found for this week")
    expect(emptySearchHeading(monday, true, "sunday")).toBe("No spots found for Oct 20, 2026 – Oct 25, 2026")
  })

  it("preserves existing desktop keyword parsing and quick-filter behavior", () => {
    const desktop = parseSearchInput({ query: "tomorrow", quickFilters: ["this_week"] })
    expect(desktop.date).toBe("2026-10-21")
    expect(desktop.dateRange).toEqual({ start: "2026-10-20", end: "2026-10-24" })
    expect(parseSearchInput({ query: "this week", quickFilters: [] }).dateRange).toBeUndefined()
    expect(toggleSearchFilter({ query: "tomorrow", quickFilters: [] }, "today", false))
      .toEqual({ query: "tomorrow", quickFilters: ["today"] })
  })

  it("retains non-date parser criteria after extraction", () => {
    expect(parse("main building accessible indoor cheap", [])).toMatchObject({
      location: "750 pandora ave", spotType: "accessible", isInside: true, priceMax: 25,
    })
    expect(parse("tesla electric outside $10 to $20", [])).toMatchObject({
      spotType: "tesla_ev", isInside: false, priceMin: 10, priceMax: 20,
    })
    expect(parse("north under $15", [])).toMatchObject({ location: "north lot", priceMax: 15 })
  })
})

describe("price search parsing and literal matching", () => {
  it.each([
    ["covered cheap", { isInside: true, priceMax: 25 }],
    ["COVERED CHEAP", { isInside: true, priceMax: 25 }],
    ["underground affordable", { isInside: true, priceMax: 25 }],
    ["UNDERGROUND AFFORDABLE", { isInside: true, priceMax: 25 }],
    ["covered electric under $15", { isInside: true, spotType: "electric", priceMax: 15 }],
    ["underground accessible OVER $30", { isInside: true, spotType: "accessible", priceMin: 30 }],
    ["covered tesla electric $10 TO $20", { isInside: true, spotType: "tesla_ev", priceMin: 10, priceMax: 20 }],
    ["outdoor regular 10-20", { isInside: false, spotType: "regular", priceMin: 10, priceMax: 20 }],
    ["covered premium", { isInside: true, priceMin: 30 }],
    ["underground expensive", { isInside: true, priceMin: 30 }],
    ["covered LeSs   ThAn $15", { isInside: true, priceMax: 15 }],
    ["underground MoRe   ThAn $30", { isInside: true, priceMin: 30 }],
    ["covered BELOW $15", { isInside: true, priceMax: 15 }],
    ["covered ABOVE $30", { isInside: true, priceMin: 30 }],
  ])("parses complete price phrases in %s on mobile and desktop", (query, expected) => {
    for (const mobile of [true, false]) {
      const criteria = parseSearchInput({ query, quickFilters: [] }, mobile)
      expect(criteria).toMatchObject(expected)
      expect(criteria.priceMin).toBe("priceMin" in expected ? expected.priceMin : undefined)
      expect(criteria.priceMax).toBe("priceMax" in expected ? expected.priceMax : undefined)
    }
  })

  it.each(["covered", "underground", "leftover30", "thunder15", "cheapest", "unaffordable", "premiumize"])(
    "does not interpret substrings in %s as price keywords", query => {
      const criteria = parse(query, [])
      expect(criteria.priceMin).toBeUndefined()
      expect(criteria.priceMax).toBeUndefined()
      expect(matchesSearchText(query, "unrelated spot text")).toBe(false)
      expect(matchesSearchText(query, query)).toBe(true)
    },
  )

  it.each([
    ["covered cheap", "covered indoor", 25, undefined],
    ["underground affordable", "underground indoor", 25, undefined],
    ["under $15", "regular spot", 15, undefined],
    ["over $30", "regular spot", undefined, 30],
    ["covered electric under $15", "covered indoor electric ev", 15, undefined],
    ["underground accessible OVER $30", "underground indoor accessible", undefined, 30],
    ["covered tesla electric $10 TO $20", "covered indoor tesla electric", 20, 10],
    ["outdoor regular 10-20", "outdoor regular", 20, 10],
  ])("retains matching tiles through literal and numeric filtering for %s", (query, text, max, min) => {
    for (const mobile of [true, false]) {
      const criteria = parseSearchInput({ query, quickFilters: [] }, mobile)
      // Include a $20 tile: cheap/affordable must honor the parser's $25 cap,
      // not depend on the page's separate <= $12 deal/budget badge keywords.
      const prices = [0, 10, 15, 20, 25, 29, 30, 31, 40]
      const results = prices.filter(price =>
        matchesSearchText(query, `${text} $${price}`, mobile) &&
        (criteria.priceMin === undefined || price >= criteria.priceMin) &&
        (criteria.priceMax === undefined || price <= criteria.priceMax),
      )
      expect(results).toEqual(prices.filter(price =>
        (max === undefined || price <= max) && (min === undefined || price >= min),
      ))
      expect(matchesSearchText(`${query} charity`, text, mobile)).toBe(false)
    }
  })

  it("preserves mobile date handling and unrelated literal words with price phrases", () => {
    expect(matchesSearchText("tomorrow covered cheap charity", "covered charity $20", true)).toBe(true)
    expect(matchesSearchText("tomorrow covered cheap charity", "covered charity $20", false)).toBe(false)
    expect(matchesSearchText("covered under", "covered $10")).toBe(false)
    expect(parse("covered under cheap", []).priceMax).toBe(25)
  })

  it("wires tested literal matching and numeric price bounds into the search page", () => {
    const page = readFileSync(new URL("../pages/search.tsx", import.meta.url), "utf8")
    expect(page).toContain("matchesSearchText(query, searchableText, isMobile)")
    expect(page).toContain("if (priceMin !== undefined && spot.price < priceMin) return false")
    expect(page).toContain("if (priceMax !== undefined && spot.price > priceMax) return false")
  })
})

describe("date-specific empty headings", () => {
  it("derives headings from dates, not stale labels, with additional filters", () => {
    expect(heading({ query: "electric", quickFilters: ["today"], date: "2026-10-21", spotType: "electric" }))
      .toBe("No spots found for tomorrow")
    expect(heading({ query: "electric", quickFilters: ["tomorrow"], date: "2026-10-20" }))
      .toBe("No spots found for today")
    expect(heading({ query: "charity", quickFilters: [] })).toBe("No spots found")
    expect(heading({ query: "", quickFilters: ["today"] })).toBe("No spots found")
  })

  it("formats arbitrary dates and inclusive ranges without a timezone shift", () => {
    const base = { query: "", quickFilters: [] }
    expect(heading({ ...base, date: "2027-01-02" })).toBe("No spots found for Jan 2, 2027")
    expect(heading({ ...base, dateRange: { start: "2026-12-31", end: "2027-01-02" } }))
      .toBe("No spots found for Dec 31, 2026 – Jan 2, 2027")
    expect(heading({ ...base, dateRange: { start: "2027-01-02", end: "2027-01-02" } }))
      .toBe("No spots found for Jan 2, 2027")
  })

  it("keeps desktop headings generic for any effective filter", () => {
    for (const criteria of [parse(), parse("tomorrow"), parse("this week"), parse("electric")]) {
      expect(emptySearchHeading(criteria, false)).toBe("No spots found")
    }
  })

  it("uses calendar dates across DST and year boundaries", () => {
    vi.setSystemTime(new Date("2026-11-01T08:30:00Z"))
    expect(heading(parse("tomorrow"))).toBe("No spots found for tomorrow")
    expect(parse("tomorrow").date).toBe("2026-11-02")
    vi.setSystemTime(new Date("2027-01-01T03:00:00Z"))
    expect(parse().date).toBe("2026-12-31")
    expect(parse("tomorrow").date).toBe("2027-01-01")
  })
})

describe("daily tiles expanded from multi-date listings", () => {
  const days = ["2026-10-20", "2026-10-21", "2026-10-24", "2026-10-25"]
  const tiles = days.map(date => ({ availability: { date }, availabilityDates: days }))
  const results = (criteria: ParsedSearch) =>
    tiles.filter(tile => matchesSearchDate(tile.availability.date, criteria)).map(t => t.availability.date)
  it("matches only the expanded tile date, not another day on its parent listing", () => {
    expect(results(parse())).toEqual(["2026-10-20"])
    expect(results(parse("tomorrow"))).toEqual(["2026-10-21"])
    expect(results(parse("this week"))).toEqual(["2026-10-20", "2026-10-21", "2026-10-24"])
  })
  it("excludes undated tiles for date searches, and includes all dates when cleared", () => {
    expect(matchesSearchDate(undefined, parse())).toBe(false)
    expect(results(parse("", []))).toEqual(days)
    expect(matchesSearchDate(undefined, parse("", []))).toBe(true)
  })
})

describe("search-page base/date filtering pipeline", () => {
  it("retains parking-zone Today when the device calendar has already reached tomorrow", () => {
    const previousTZ = process.env.TZ
    process.env.TZ = "UTC"
    try {
      // The shared beforeEach freezes time at Oct 21 02:00 UTC / Oct 20 19:00 LA.
      expect(new Date().getDate()).toBe(21)
      const criteria = parseSearchInput(initialSearchInput(390), true)
      expect(criteria.date).toBe("2026-10-20")
      const expandedTiles = ["2026-10-19", "2026-10-20", "2026-10-21"].map(date => ({
        isAvailable: true, isBookable: true, availability: { date }, availabilityDates: [date],
      }))
      // Exercise both predicates used by the page, in page order, not only date matching.
      const mobileResults = expandedTiles.filter(spot => isSearchTileAvailable(spot, true))
        .filter(spot => matchesSearchDate(spot.availability.date, criteria))
      expect(mobileResults.map(spot => spot.availability.date)).toEqual(["2026-10-20"])
      expect(expandedTiles.filter(spot => isSearchTileAvailable(spot, false)).map(spot => spot.availability.date))
        .toEqual(["2026-10-20", "2026-10-21"])
    } finally {
      if (previousTZ === undefined) delete process.env.TZ
      else process.env.TZ = previousTZ
    }
  })

  it("still excludes unavailable and non-bookable tiles before date matching", () => {
    const tile = { availability: { date: getTodayInTimezoneSync() }, isAvailable: true, isBookable: true }
    expect(isSearchTileAvailable(tile, true)).toBe(true)
    expect(isSearchTileAvailable({ ...tile, isAvailable: false }, true)).toBe(false)
    expect(isSearchTileAvailable({ ...tile, isBookable: false }, true)).toBe(false)
  })

  it("wires the tested base predicate into the real page before its date filtering", () => {
    const page = readFileSync(new URL("../pages/search.tsx", import.meta.url), "utf8")
    const baseFilter = page.slice(page.indexOf("const baseFilteredSpots ="), page.indexOf("const filteredSpots ="))
    expect(baseFilter).toContain("isSearchTileAvailable(spot, isMobile)")
    expect(baseFilter).not.toContain("isPastDate(")
    expect(page).toContain("return matchesSearchDate(spot.availability?.date, searchCriteria)")
  })
})

describe("shared search debounce", () => {
  it("does not schedule an empty initial search or remove the default after 300ms", () => {
    const apply = vi.fn()
    const pending = createSearchDebouncer<SearchInput>(apply)
    vi.advanceTimersByTime(1000)
    expect(apply).not.toHaveBeenCalled()
    pending.cancel()
  })

  it.each(["input clear", "results clear"])("%s cancels pending typing and cannot restore old filters", () => {
    const apply = vi.fn()
    const pending = createSearchDebouncer<SearchInput>(apply)
    pending.update({ query: "tomorrow electric", quickFilters: ["today"] }, true)
    vi.advanceTimersByTime(299)
    pending.update({ query: "", quickFilters: [] })
    vi.advanceTimersByTime(1000)
    expect(apply).toHaveBeenCalledExactlyOnceWith({ query: "", quickFilters: [] })
  })

  it("debounces typing, but quick-filter changes and explicit Search are immediate", () => {
    const apply = vi.fn()
    const pending = createSearchDebouncer<SearchInput>(apply)
    pending.update({ query: "tom", quickFilters: ["today"] }, true)
    vi.advanceTimersByTime(200)
    pending.update({ query: "tomorrow", quickFilters: ["today"] }, true)
    vi.advanceTimersByTime(299)
    expect(apply).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(apply).toHaveBeenLastCalledWith({ query: "tomorrow", quickFilters: ["today"] })
    pending.update({ query: "electric", quickFilters: ["today"] }, true)
    const week = { query: "electric", quickFilters: ["this_week"] }
    pending.update(week)
    expect(apply).toHaveBeenLastCalledWith(week)
    vi.advanceTimersByTime(1000)
    expect(apply).toHaveBeenCalledTimes(2)
  })

  it("cancels timers on unmount", () => {
    const apply = vi.fn()
    const pending = createSearchDebouncer<SearchInput>(apply)
    pending.update(initialSearchInput(390), true)
    pending.cancel()
    vi.advanceTimersByTime(300)
    expect(apply).not.toHaveBeenCalled()
  })
})
