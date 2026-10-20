import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';

// Default timezone (PST/PDT) - matches backend default
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// One source for synchronous UI and asynchronous formatting. Never clear a known
// timezone during refresh: date-dependent UI must not temporarily fall back to LA.
let cachedTimezone: string | null = null;
let fetchedAt = 0;
let pendingTimezone: Promise<string> | null = null;
let revision = 0;
const listeners = new Set<() => void>();
export const TIMEZONE_REFRESH_MS = 5 * 60 * 1000;

export function subscribeToTimezone(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Publish only a validated setting (also used after an admin saves it). */
export function setConfiguredTimezone(timezone: string): void {
  if (!timezone.trim()) throw new Error('Application timezone cannot be empty');
  new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
  revision++;
  fetchedAt = Date.now();
  if (cachedTimezone === timezone) return;
  cachedTimezone = timezone;
  listeners.forEach(listener => listener());
}

/** Must be initialized behind the authenticated UI gate, not a guessed first date. */
export function getConfiguredTimezoneSync(): string {
  if (cachedTimezone === null) throw new Error('Application timezone has not loaded');
  return cachedTimezone;
}

/** Fetch the existing authenticated config endpoint, sharing concurrent requests. */
export async function getConfiguredTimezone(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedTimezone && Date.now() - fetchedAt < TIMEZONE_REFRESH_MS) {
    return cachedTimezone;
  }
  if (pendingTimezone) return pendingTimezone;
  const requestRevision = revision;
  pendingTimezone = (async () => {
    const response = await fetch('/api/app-configs/timezone', {
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    // Missing setting uses the same default as the backend. Network/auth/server
    // errors are not evidence that the app uses LA: let the UI offer a retry.
    let timezone = DEFAULT_TIMEZONE;
    if (response.status !== 404) {
      if (!response.ok) throw new Error('Unable to load the application timezone');
      const config = await response.json();
      if (config.key !== 'timezone' || typeof config.value !== 'string') {
        throw new Error('Invalid application timezone configuration');
      }
      timezone = config.value || DEFAULT_TIMEZONE;
    }
    // An admin save that finished during this request takes precedence.
    if (revision === requestRevision) setConfiguredTimezone(timezone);
    return getConfiguredTimezoneSync();
  })();
  try {
    return await pendingTimezone;
  } finally {
    pendingTimezone = null;
  }
}

/**
 * Get today's calendar date in the initialized application timezone.
 */
export function getTodayInTimezoneSync(): string {
  return formatInTimeZone(new Date(), getConfiguredTimezoneSync(), 'yyyy-MM-dd');
}

// UTC here is only a calendar-arithmetic container, not an instant to convert
// back to the parking zone (that would shift the day in UTC+13/+14 zones).
function calendarDay(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

/** Advance the configured calendar day, not the current instant by 24 hours. */
export function getTomorrowInTimezoneSync(): string {
  const day = calendarDay(getTodayInTimezoneSync());
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/**
 * Get the end-of-week date string in the initialized application timezone.
 *
 * @param weekStartDay - 'sunday' (default) means the week starts on Sunday and ends on Saturday (Canadian/BCI convention).
 *                       'monday' means the week starts on Monday and ends on Sunday.
 *
 * Calendar arithmetic avoids DST-length days and extreme-offset date shifts.
 */
export function getEndOfWeekInTimezoneSync(weekStartDay: string = 'sunday'): string {
  const day = calendarDay(getTodayInTimezoneSync());
  const dayOfWeek = day.getUTCDay();

  let daysUntilEnd: number;
  if (weekStartDay === 'sunday') {
    // Week: Sunday → Saturday; end day = Saturday (6)
    daysUntilEnd = (6 - dayOfWeek + 7) % 7;
  } else {
    // Week: Monday → Sunday; end day = Sunday (0)
    daysUntilEnd = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  }

  day.setUTCDate(day.getUTCDate() + daysUntilEnd);
  return day.toISOString().slice(0, 10);
}

/**
 * Get today's date string in YYYY-MM-DD format in the configured timezone
 */
export async function getTodayInTimezone(): Promise<string> {
  const timezone = await getConfiguredTimezone();
  const now = new Date();
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

/**
 * Format a date string or Date object in the configured timezone
 * @param date - Date object or ISO string or YYYY-MM-DD string
 * @param formatStr - Format string (default: 'MM/dd/yyyy' for display)
 */
export async function formatDateInTimezone(
  date: Date | string,
  formatStr: string = 'MM/dd/yyyy'
): Promise<string> {
  if (!date) return '';
  
  const timezone = await getConfiguredTimezone();
  
  // Handle YYYY-MM-DD format from database
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Parse date components to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return format(dateObj, formatStr);
  }
  
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, timezone, formatStr);
}

/**
 * Format a date for display in MM/DD/YYYY format
 * Specifically handles YYYY-MM-DD strings from database
 */
export async function formatDateForDisplay(dateString: string | null | undefined): Promise<string> {
  if (!dateString) return '';
  
  // For YYYY-MM-DD format from database, parse components directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
  }
  
  return formatDateInTimezone(dateString, 'MM/dd/yyyy');
}

/**
 * Format a date for database storage (YYYY-MM-DD)
 * Uses configured timezone to ensure correct date
 */
export async function formatDateForDB(date: Date | string): Promise<string> {
  if (typeof date === 'string') {
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
  }
  
  const timezone = await getConfiguredTimezone();
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, timezone, 'yyyy-MM-dd');
}

/**
 * Convert a date to the configured timezone
 */
export async function toConfiguredTimezone(date: Date | string): Promise<Date> {
  const timezone = await getConfiguredTimezone();
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(dateObj, timezone);
}

/**
 * Check if a date string is in the past (compared to today in configured timezone)
 */
export async function isDateInPast(dateStr: string): Promise<boolean> {
  const today = await getTodayInTimezone();
  return dateStr < today;
}

/**
 * Check if a date string is today or in the future (in configured timezone)
 */
export async function isDateTodayOrFuture(dateStr: string): Promise<boolean> {
  const today = await getTodayInTimezone();
  return dateStr >= today;
}

/**
 * Get current date/time in configured timezone
 */
export async function getNowInTimezone(): Promise<Date> {
  const timezone = await getConfiguredTimezone();
  return toZonedTime(new Date(), timezone);
}

/**
 * Format a datetime with timezone for display
 * @param date - Date object or ISO string
 * @param formatStr - Format string (default: 'MM/dd/yyyy h:mm a')
 */
export async function formatDateTimeInTimezone(
  date: Date | string,
  formatStr: string = 'MM/dd/yyyy h:mm a'
): Promise<string> {
  if (!date) return '';
  
  const timezone = await getConfiguredTimezone();
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, timezone, formatStr);
}
