import { format } from "date-fns"

/** Easter Sunday date for a given year (Meeus/Jones/Butcher algorithm). */
function getEasterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

/** Nth occurrence of a weekday (0=Sun … 6=Sat) in a month (0-based). */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return new Date(year, month, 1 + offset + (n - 1) * 7)
}

/** Last Monday on or before May 24 (Victoria Day rule). */
function victoriaDay(year: number): Date {
  const may24 = new Date(year, 4, 24)
  const dow = may24.getDay()
  const sub = dow === 1 ? 0 : dow === 0 ? 6 : dow - 1
  return new Date(year, 4, 24 - sub)
}

/**
 * Returns a map of { "YYYY-MM-DD": "Holiday Name" } for BC/Victoria
 * statutory holidays in the given year.
 */
export function getBCStatHolidays(year: number): Record<string, string> {
  const fmt = (d: Date) => format(d, "yyyy-MM-dd")
  const easter = getEasterDate(year)
  const easterMs = easter.getTime()
  return {
    [fmt(new Date(year, 0, 1))]:                    "New Year's Day",
    [fmt(nthWeekday(year, 1, 1, 3))]:               "Family Day",
    [fmt(new Date(easterMs - 2 * 86_400_000))]:     "Good Friday",
    [fmt(new Date(easterMs + 86_400_000))]:          "Easter Monday",
    [fmt(victoriaDay(year))]:                        "Victoria Day",
    [fmt(new Date(year, 6, 1))]:                     "Canada Day",
    [fmt(nthWeekday(year, 7, 1, 1))]:               "BC Day",
    [fmt(nthWeekday(year, 8, 1, 1))]:               "Labour Day",
    [fmt(new Date(year, 8, 30))]:                    "Truth & Reconciliation Day",
    [fmt(nthWeekday(year, 9, 1, 2))]:               "Thanksgiving Day",
    [fmt(new Date(year, 10, 11))]:                   "Remembrance Day",
    [fmt(new Date(year, 11, 25))]:                   "Christmas Day",
    [fmt(new Date(year, 11, 26))]:                   "Boxing Day",
  }
}

/**
 * Returns a merged holiday map covering the given year and the next,
 * suitable for calendars that may span a year boundary.
 */
export function getBCStatHolidaysForRange(startYear: number, endYear: number = startYear + 1): Record<string, string> {
  const result: Record<string, string> = {}
  for (let y = startYear; y <= endYear; y++) {
    Object.assign(result, getBCStatHolidays(y))
  }
  return result
}
