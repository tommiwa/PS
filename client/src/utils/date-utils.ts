/**
 * Utility functions for date handling in the parking application
 */

/**
 * Check if a date is in the past (before today)
 */
export function isPastDate(date: Date | string): boolean {
  const dateToCheck = typeof date === 'string' ? new Date(date) : date;
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