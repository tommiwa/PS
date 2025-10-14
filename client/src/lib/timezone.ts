import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';

// Default timezone (PST/PDT) - matches backend default
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// Cache for timezone config
let cachedTimezone: string | null = null;

/**
 * Fetch the configured timezone from the backend
 */
export async function getConfiguredTimezone(): Promise<string> {
  // Return cached value if available
  if (cachedTimezone) {
    return cachedTimezone;
  }

  try {
    const response = await fetch('/api/app-configs');
    if (!response.ok) {
      console.warn('Failed to fetch app configs, using default timezone');
      return DEFAULT_TIMEZONE;
    }

    const configs = await response.json();
    const timezoneConfig = configs.find((c: any) => c.key === 'timezone');
    
    const timezone = timezoneConfig?.value || DEFAULT_TIMEZONE;
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
