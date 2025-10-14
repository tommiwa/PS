import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';
import type { IStorage } from './storage';

// Default timezone (PST/PDT)
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// Cache for timezone config
let cachedTimezone: string | null = null;
let storage: IStorage | null = null;

/**
 * Initialize timezone utilities with storage
 */
export function initTimezone(storageInstance: IStorage) {
  storage = storageInstance;
}

/**
 * Get the configured timezone from app settings
 */
export async function getConfiguredTimezone(): Promise<string> {
  if (!storage) {
    console.warn('Timezone utilities not initialized, using default timezone');
    return DEFAULT_TIMEZONE;
  }

  // Return cached value if available (refresh every 5 minutes)
  if (cachedTimezone) {
    return cachedTimezone;
  }

  try {
    const timezoneConfig = await storage.getAppConfigValue('timezone');
    const timezone = timezoneConfig || DEFAULT_TIMEZONE;
    cachedTimezone = timezone;
    
    // Clear cache after 5 minutes
    setTimeout(() => {
      cachedTimezone = null;
    }, 5 * 60 * 1000);
    
    return timezone;
  } catch (error) {
    console.error('Error fetching timezone config:', error);
    return DEFAULT_TIMEZONE;
  }
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
 * @param date - Date object or ISO string
 * @param formatStr - Format string (default: 'yyyy-MM-dd')
 */
export async function formatDateInTimezone(
  date: Date | string,
  formatStr: string = 'yyyy-MM-dd'
): Promise<string> {
  const timezone = await getConfiguredTimezone();
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, timezone, formatStr);
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
 * Convert a date from the configured timezone to UTC
 */
export async function fromConfiguredTimezone(date: Date | string): Promise<Date> {
  const timezone = await getConfiguredTimezone();
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return fromZonedTime(dateObj, timezone);
}

/**
 * Get current time in configured timezone
 */
export async function getNowInTimezone(): Promise<Date> {
  const timezone = await getConfiguredTimezone();
  return toZonedTime(new Date(), timezone);
}

/**
 * Compare two date strings in the configured timezone
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDateStrings(date1: string, date2: string): number {
  if (date1 < date2) return -1;
  if (date1 > date2) return 1;
  return 0;
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
