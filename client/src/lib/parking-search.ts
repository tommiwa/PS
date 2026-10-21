import { getTodayInTimezoneSync, getTomorrowInTimezoneSync, getEndOfWeekInTimezoneSync } from "./timezone"

export interface SearchInput {
  query: string
  quickFilters: string[]
}

export interface ParsedSearch extends SearchInput {
  location?: string
  spotType?: "regular" | "accessible" | "electric" | "tesla_ev" | "reserved" | "all"
  priceMin?: number
  priceMax?: number
  date?: string
  dateRange?: { start: string; end: string }
  isInside?: boolean
  isBciManaged?: boolean
}

export const SEARCH_MOBILE_BREAKPOINT = 768
const DATE_FILTERS = ["today", "tomorrow", "this_week"]

export function initialSearchInput(width?: number): SearchInput {
  return { query: "", quickFilters: width !== undefined && width < SEARCH_MOBILE_BREAKPOINT ? ["today"] : [] }
}

export function withoutDateKeywords(query: string): string {
  return query.replace(/\b(today|tomorrow|this\s+week)\b/gi, " ").replace(/\s+/g, " ").trim()
}

// Keep price criteria and literal text consumption together: a price expression
// must not also require a spot's description to contain words such as "under".
function parsePriceQuery(query: string): Pick<ParsedSearch, "priceMin" | "priceMax"> & { literalQuery: string } {
  const range = query.match(/\$?\b(\d+)\s*(?:\bto\b|-)\s*\$?(\d+)\b/i)
  const under = query.match(/\b(?:under|less\s+than|below)\s*\$?(\d+)\b/i)
  const over = query.match(/\b(?:over|more\s+than|above)\s*\$?(\d+)\b/i)
  const cheap = query.match(/\b(?:cheap|affordable)\b/i)
  const premium = query.match(/\b(?:expensive|premium)\b/i)
  const match = range || under || over || cheap || premium
  const price: Pick<ParsedSearch, "priceMin" | "priceMax"> = {}
  if (range) {
    price.priceMin = Number(range[1])
    price.priceMax = Number(range[2])
  } else if (under) price.priceMax = Number(under[1])
  else if (over) price.priceMin = Number(over[1])
  else if (cheap) price.priceMax = 25
  else if (premium) price.priceMin = 30
  return { ...price, literalQuery: match ? query.replace(match[0], " ").trim() : query }
}

export function matchesSearchText(query: string, searchableText: string, mobile = false): boolean {
  const { literalQuery } = parsePriceQuery(mobile ? withoutDateKeywords(query) : query)
  const text = searchableText.toLowerCase()
  return literalQuery.toLowerCase().split(/\s+/).filter(Boolean).every(term => text.includes(term))
}

export function parseSearchInput(
  input: SearchInput,
  mobile = false,
  weekStartDay = "sunday",
): ParsedSearch {
  const { query: searchQuery, quickFilters: filters } = input
  const parsed: ParsedSearch = { query: searchQuery, quickFilters: [...filters] }
  const terms = searchQuery.toLowerCase().split(/\s+/)
  const setDate = (filter: string) => {
    if (mobile) {
      delete parsed.date
      delete parsed.dateRange
    }
    if (filter === "today") parsed.date = getTodayInTimezoneSync()
    if (filter === "tomorrow") parsed.date = getTomorrowInTimezoneSync()
    if (filter === "this_week") parsed.dateRange = {
      start: getTodayInTimezoneSync(),
      end: getEndOfWeekInTimezoneSync(weekStartDay),
    }
  }

  filters.forEach(filter => {
    if (DATE_FILTERS.includes(filter)) setDate(filter)
    else if (filter === "electric" || filter === "tesla_ev" || filter === "accessible") parsed.spotType = filter
    else if (filter === "750 pandora ave") parsed.location = filter
  })

  if (["main", "building"].every(word => searchQuery.toLowerCase().includes(word))) parsed.location = "750 pandora ave"
  else if (terms.includes("north")) parsed.location = "north lot"
  else if (terms.includes("south")) parsed.location = "south lot"
  else if (terms.includes("west")) parsed.location = "west garage"

  if (terms.includes("tesla") && terms.some(t => ["ev", "electric", "charging"].includes(t))) parsed.spotType = "tesla_ev"
  else if (terms.some(t => ["electric", "ev", "charging"].includes(t))) parsed.spotType = "electric"
  else if (terms.some(t => ["accessible", "handicap", "disabled"].includes(t))) parsed.spotType = "accessible"
  else if (terms.some(t => ["reserved", "executive"].includes(t))) parsed.spotType = "reserved"
  else if (terms.some(t => ["regular", "normal"].includes(t))) parsed.spotType = "regular"

  if (terms.some(t => ["inside", "indoor", "covered", "underground"].includes(t))) parsed.isInside = true
  else if (terms.some(t => ["outside", "outdoor", "open"].includes(t))) parsed.isInside = false

  const { literalQuery: _literalQuery, ...price } = parsePriceQuery(searchQuery)
  Object.assign(parsed, price)

  if (terms.includes("today")) setDate("today")
  else if (terms.includes("tomorrow")) setDate("tomorrow")
  else if (mobile && /\bthis\s+week\b/i.test(searchQuery)) setDate("this_week")
  return parsed
}

// Infer the highlighted date button from the effective dates, never a stale quick-filter label.
export function effectiveDateFilter(criteria: ParsedSearch, weekStartDay = "sunday"): string | undefined {
  if (criteria.dateRange) {
    return criteria.dateRange.start === getTodayInTimezoneSync() &&
      criteria.dateRange.end === getEndOfWeekInTimezoneSync(weekStartDay) ? "this_week" : undefined
  }
  if (criteria.date === getTodayInTimezoneSync()) return "today"
  if (criteria.date === getTomorrowInTimezoneSync()) return "tomorrow"
}

export function toggleSearchFilter(input: SearchInput, value: string, mobile: boolean, weekStartDay = "sunday"): SearchInput {
  const isDate = DATE_FILTERS.includes(value)
  const exists = mobile && isDate
    ? effectiveDateFilter(parseSearchInput(input, mobile, weekStartDay), weekStartDay) === value
    : input.quickFilters.includes(value)
  let query = input.query
  let filters = [...input.quickFilters]
  if (mobile && isDate) {
    query = withoutDateKeywords(query)
    filters = filters.filter(f => !DATE_FILTERS.includes(f))
  }
  if (exists) {
    filters = filters.filter(f => f !== value)
    query = query.replace(new RegExp(`\\b${value}\\b`, "gi"), "").replace(/\s+/g, " ").trim()
  } else {
    if (isDate) filters = filters.filter(f => !DATE_FILTERS.includes(f))
    filters.push(value)
    if (!isDate && !query.toLowerCase().includes(value.toLowerCase())) query = query ? `${query} ${value}` : value
  }
  return { query, quickFilters: filters }
}

function readableDate(date: string): string {
  // Calendar dates are not UTC instants: explicit UTC formatting avoids host-timezone shifts.
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`))
}

export function emptySearchHeading(criteria: ParsedSearch, mobile: boolean, weekStartDay = "sunday"): string {
  if (!mobile) return "No spots found"
  const filter = effectiveDateFilter(criteria, weekStartDay)
  if (filter === "this_week") return "No spots found for this week"
  if (criteria.dateRange) {
    const { start, end } = criteria.dateRange
    return start === end ? `No spots found for ${readableDate(start)}` : `No spots found for ${readableDate(start)} – ${readableDate(end)}`
  }
  if (filter === "today" || filter === "tomorrow") return `No spots found for ${filter}`
  return criteria.date ? `No spots found for ${readableDate(criteria.date)}` : "No spots found"
}

// Apply this to already-expanded daily tiles, not the listing's other available dates.
export function matchesSearchDate(date: string | undefined, criteria: ParsedSearch): boolean {
  if (criteria.dateRange) return !!date && date >= criteria.dateRange.start && date <= criteria.dateRange.end
  return !criteria.date || date === criteria.date
}

export function isSearchTileAvailable(spot: {
  availability?: { date: string }
  isAvailable: boolean
  isBookable?: boolean | null
}, mobile: boolean): boolean {
  if (!spot.isAvailable || spot.isBookable === false) return false
  const date = spot.availability?.date
  if (!date) return true
  // The base filter must use the same calendar day as the date parser.
  // Otherwise a phone whose date is ahead of the parking zone drops Today first.
  return date >= getTodayInTimezoneSync()
}

export function createSearchDebouncer<T>(apply: (input: T) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = () => { clearTimeout(timer); timer = undefined }
  return {
    cancel,
    update(input: T, debounce = false) {
      cancel()
      if (debounce) timer = setTimeout(() => { timer = undefined; apply(input) }, 300)
      else apply(input)
    },
  }
}
