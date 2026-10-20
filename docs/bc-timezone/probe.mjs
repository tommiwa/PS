// Read-only assessment. Run from the repository root:
// node --import tsx docs/bc-timezone/probe.mjs
// Optional isolated Chromium Intl probe (does NOT load the app):
// node --import tsx docs/bc-timezone/probe.mjs --browser /path/to/chrome
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { formatInTimeZone } from 'date-fns-tz';
import {
  getTodayInTimezoneSync,
  getTomorrowInTimezoneSync,
  getEndOfWeekInTimezoneSync,
  formatDateForDB,
  formatDateForDisplay,
} from '../../client/src/lib/timezone.ts';
import { getTodayInTimezone, isDateInPast, formatDateInTimezone } from '../../server/timezone.ts';
import { initialSearchInput, parseSearchInput } from '../../client/src/lib/parking-search.ts';

const NativeDate = Date;
const inputs = [
  ['2025-12-01T07:30:00Z', '2025-11-30 23:30:00 -08:00'],
  ['2026-03-08T09:59:59Z', '2026-03-08 01:59:59 -08:00'],
  ['2026-03-08T10:00:00Z', '2026-03-08 03:00:00 -07:00'],
  ['2026-11-01T08:59:59Z', '2026-11-01 01:59:59 -07:00'],
  ['2026-11-01T09:00:00Z', '2026-11-01 02:00:00 -07:00'],
  ['2026-11-01T18:00:00Z', '2026-11-01 11:00:00 -07:00'],
  ['2026-11-02T07:30:00Z', '2026-11-02 00:30:00 -07:00'],
  ['2026-12-01T07:30:00Z', '2026-12-01 00:30:00 -07:00'],
  ['2027-01-01T07:30:00Z', '2027-01-01 00:30:00 -07:00'],
  ['2027-03-14T09:59:59Z', '2027-03-14 02:59:59 -07:00'],
  ['2027-03-14T10:00:00Z', '2027-03-14 03:00:00 -07:00'],
  ['2027-07-01T07:30:00Z', '2027-07-01 00:30:00 -07:00'],
];
const boundaries = inputs.map(([utc, expectedVancouver]) => {
  const actualVancouver = formatInTimeZone(utc, 'America/Vancouver', 'yyyy-MM-dd HH:mm:ss XXX');
  return {
    utc, expectedVancouver, actualVancouver,
    actualLosAngeles: formatInTimeZone(utc, 'America/Los_Angeles', 'yyyy-MM-dd HH:mm:ss XXX'),
    matchesBC: actualVancouver === expectedVancouver,
  };
});
const result = {
  runtime: { node: process.version, icu: process.versions.icu, tz: process.versions.tz,
    hostZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  boundaries,
};
try {
  // Freeze only this isolated process; do not initialize storage or import app startup.
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : ['2026-12-06T07:30:00Z'])); }
    static now() { return new NativeDate('2026-12-06T07:30:00Z').getTime(); }
  };
  result.actualHelpers = {
    input: new Date().toISOString(),
    expected: { today: '2026-12-06', tomorrow: '2026-12-07', sundayWeekEnd: '2026-12-12', mondayWeekEnd: '2026-12-06', december5InPast: true },
    actual: {
      today: getTodayInTimezoneSync(), tomorrow: getTomorrowInTimezoneSync(),
      sundayWeekEnd: getEndOfWeekInTimezoneSync('sunday'),
      mondayWeekEnd: getEndOfWeekInTimezoneSync('monday'),
      serverDefaultToday: await getTodayInTimezone(),
      december5InPast: await isDateInPast('2026-12-05'),
    },
  };
  result.mergedMobileSearch = {
    freshMobile: parseSearchInput(initialSearchInput(390), true),
    freshDesktop: parseSearchInput(initialSearchInput(1024), false),
    clearedMobile: parseSearchInput({ query: '', quickFilters: [] }, true),
  };
  assert.equal(result.mergedMobileSearch.freshDesktop.date, undefined);
  assert.equal(result.mergedMobileSearch.clearedMobile.date, undefined);
  result.unaffected = {
    dateOnlyDB: await formatDateForDB('2026-12-01'),
    dateOnlyDisplay: await formatDateForDisplay('2026-12-01'),
    databaseDateObject: await formatDateInTimezone(new Date('2026-12-01T00:00:00Z')),
    dateOnlyServerString: await formatDateInTimezone('2026-12-01'),
    twoMinuteExpiryElapsedMs: new Date(Date.now() + 120000).getTime() - Date.now(),
    thirtyDayElapsedMs: new Date(Date.now() + 30 * 86400000).getTime() - Date.now(),
  };
  assert.equal(result.unaffected.dateOnlyDB, '2026-12-01');
  assert.equal(result.unaffected.dateOnlyDisplay, '12/01/2026');
  assert.equal(result.unaffected.databaseDateObject, '2026-12-01');
  assert.equal(result.unaffected.dateOnlyServerString, '2026-12-01');
  assert.equal(result.unaffected.twoMinuteExpiryElapsedMs, 120000);
  assert.equal(result.unaffected.thirtyDayElapsedMs, 2592000000);
} finally { globalThis.Date = NativeDate; }

// Reproduce ONLY the date expressions, never the jobs, storage methods, or notifications.
result.hostExpressions = ['UTC', 'America/Los_Angeles', 'America/Vancouver'].map(TZ => ({
  TZ,
  ...JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    const now = new Date('2026-12-01T06:30:00Z');
    const midnight = new Date(now); midnight.setHours(0,0,0,0);
    const todayStr = midnight.toISOString().split('T')[0];
    const bookingDate = new Date('2026-12-02T00:00:00');
    console.log(JSON.stringify({
      todayStr, expectedBCToday: '2026-11-30',
      expiresNovember30: '2026-11-30' < todayStr,
      december1AssignmentDue: '2026-12-01' <= todayStr,
      payrollMonth: now.getMonth()+1, expectedBCMonth: 11,
      cancellationHours: (bookingDate-now)/3600000, expectedBCHours: 24.5,
      calendarSelectedDecember1Day: new Date('2026-12-01').getDate(),
      friendlyDecember1: new Date('2026-12-01').toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})
    }));
  `], { env: { ...process.env, TZ }, encoding: 'utf8' })),
}));
const browserArg = process.argv.indexOf('--browser');
if (browserArg !== -1) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: process.argv[browserArg + 1], headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    result.isolatedChromium = await page.evaluate(rows => ({
      userAgent: navigator.userAgent,
      boundaries: rows.map(([utc, expectedVancouver]) => ({
        utc, expectedVancouver,
        actualVancouver: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
          timeZoneName: 'longOffset',
        }).format(new Date(utc)),
      })),
    }), inputs);
  } finally { await browser.close(); }
}
console.log(JSON.stringify(result, null, 2));
