import { format } from "date-fns";

export const LEGACY_SESSION_KEY = "today-booking-badge-dismissed";
export const DISMISSED_DATE_KEY = "today-booking-badge-dismissed-date";

/** yyyy-MM-dd for the given (or current) local date. */
export function getTodayStr(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Whether the pill was dismissed for the given calendar day. */
export function isDismissedForDate(
  dateStr: string,
  storage: StorageLike | null = defaultStorage()
): boolean {
  try {
    return storage?.getItem(DISMISSED_DATE_KEY) === dateStr;
  } catch {
    return false;
  }
}

/**
 * Persist a dismissal that was initiated at `clickDateStr` (captured at click
 * time). Returns true only if the dismissal still applies to the current day —
 * i.e. midnight did not pass between the click and this call. The stored date
 * is always the click date, so a pre-midnight dismissal never hides the pill
 * on the following day.
 */
export function recordDismissal(
  clickDateStr: string,
  now: Date = new Date(),
  storage: StorageLike | null = defaultStorage()
): boolean {
  try {
    storage?.setItem(DISMISSED_DATE_KEY, clickDateStr);
  } catch {
    // ignore
  }
  return getTodayStr(now) === clickDateStr;
}
