/**
 * Pure helpers for the _internal_* app_config cleanup job.
 * Extracted so they can be unit-tested independently of the database.
 */

/**
 * Returns true only for keys that begin with the literal string "_internal_".
 * This is the JavaScript-side equivalent of the SQL `starts_with(key, '_internal_')`
 * used in the DELETE query.
 */
export function isInternalConfigKey(key: string): boolean {
  return key.startsWith('_internal_');
}

/**
 * Parses the retention window from a raw app_config value string.
 * Falls back to `defaultDays` if the value is missing, non-numeric, NaN, or <= 0.
 */
export function parseRetentionDays(raw: string | undefined, defaultDays: number): number {
  if (!raw) return defaultDays;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultDays;
}
