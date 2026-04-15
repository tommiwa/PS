/**
 * Format a date string from the database (YYYY-MM-DD) to display format (DD Mon YYYY)
 * without timezone conversion issues.
 * 
 * Database dates are stored as date-only strings (e.g., "2025-10-16").
 * When parsed as new Date("2025-10-16"), JavaScript treats it as midnight UTC,
 * which in timezones like PST/PDT shows as the previous day.
 * 
 * This function parses the date components directly to avoid timezone issues.
 */
export function formatDateFromDB(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  // Parse the date components directly (YYYY-MM-DD format)
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Month abbreviations
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Return in DD Mon YYYY format (e.g., "02 Jan 2026")
  return `${day.toString().padStart(2, '0')} ${months[month - 1]} ${year}`;
}

/**
 * Convert a date to YYYY-MM-DD format for database storage
 */
export function formatDateForDB(date: Date | string): string {
  if (typeof date === 'string') {
    // Already in string format, validate and return
    const [year, month, day] = date.split('-').map(Number);
    if (year && month && day) {
      return date;
    }
  }
  
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date in YYYY-MM-DD format for use in date inputs
 */
export function getTodayDateString(): string {
  return formatDateForDB(new Date());
}

/**
 * Map a dateRange filter value to a human-readable translated label.
 * Accepts the `t` translation function from useLanguage() so this utility
 * remains decoupled from the hook itself.
 */
export function getDateRangeLabel(range: string, t: (key: string) => string): string {
  switch (range) {
    case 'last-7-days': return t('dateRange.last7Days');
    case 'last-30-days': return t('dateRange.last30Days');
    case 'last-3-months': return t('dateRange.last3Months');
    case 'last-year': return t('dateRange.lastYear');
    default: return t('dateRange.last30Days');
  }
}
