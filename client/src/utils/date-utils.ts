/**
 * Utility functions for date handling in the parking application
 */

/**
 * Parse a YYYY-MM-DD date string as local date (not UTC)
 * This avoids timezone issues where "2026-02-04" parsed as UTC
 * becomes Feb 3 in timezones behind UTC (like PST)
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Check if a date is in the past (before today)
 */
export function isPastDate(date: Date | string): boolean {
  let dateToCheck: Date;
  
  if (typeof date === 'string') {
    // Parse date string as local date to avoid timezone issues
    dateToCheck = parseLocalDate(date);
  } else {
    dateToCheck = new Date(date);
  }
  
  const today = new Date();
  
  // Set time to start of day for accurate comparison
  today.setHours(0, 0, 0, 0);
  dateToCheck.setHours(0, 0, 0, 0);
  
  return dateToCheck < today;
}

/**
 * Check if a date is today or in the future
 */
export function isTodayOrFuture(date: Date | string): boolean {
  return !isPastDate(date);
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Format date as YYYY-MM-DD string
 */
export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}