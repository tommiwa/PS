import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('date-fns-tz', async (importOriginal) => {
  const actual = await importOriginal<typeof import('date-fns-tz')>();
  return actual;
});

import { getTodayInTimezoneSync, getTomorrowInTimezoneSync } from '../client/src/lib/timezone';

const TIMEZONE = 'America/Los_Angeles';

function mockNow(isoUtc: string) {
  const ms = new Date(isoUtc).getTime();
  vi.setSystemTime(ms);
}

describe('getTodayInTimezoneSync', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns YYYY-MM-DD matching LA local date', () => {
    vi.useFakeTimers();
    mockNow('2026-05-12T08:00:00Z'); // 1am PDT (UTC-7) = May 12
    expect(getTodayInTimezoneSync()).toBe('2026-05-12');
  });

  it('reflects the LA calendar date, not UTC, near midnight UTC', () => {
    vi.useFakeTimers();
    mockNow('2026-05-12T06:00:00Z'); // 11pm PDT May 11
    expect(getTodayInTimezoneSync()).toBe('2026-05-11');
  });
});

describe('getTomorrowInTimezoneSync — DST boundaries', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the next calendar day on a normal day', () => {
    vi.useFakeTimers();
    mockNow('2026-05-12T15:00:00Z'); // 8am PDT (UTC-7) = May 12 in LA
    expect(getTomorrowInTimezoneSync()).toBe('2026-05-13');
  });

  it('returns the correct day across month boundaries', () => {
    vi.useFakeTimers();
    mockNow('2026-05-31T15:00:00Z'); // May 31 in LA
    expect(getTomorrowInTimezoneSync()).toBe('2026-06-01');
  });

  it('returns the correct day across year boundaries', () => {
    vi.useFakeTimers();
    mockNow('2026-12-31T15:00:00Z'); // Dec 31 in LA
    expect(getTomorrowInTimezoneSync()).toBe('2027-01-01');
  });

  it('DST spring-forward (2026-03-08 -> 2026-03-09): clocks jump 2am->3am', () => {
    vi.useFakeTimers();
    // 9am UTC on spring-forward day = 1am PST (UTC-8), still Mar 8 in LA
    mockNow('2026-03-08T09:00:00Z');
    expect(getTodayInTimezoneSync()).toBe('2026-03-08');
    expect(getTomorrowInTimezoneSync()).toBe('2026-03-09');
  });

  it('DST fall-back (2026-11-01 -> 2026-11-02): clocks fall back 2am->1am', () => {
    vi.useFakeTimers();
    // 9am UTC on fall-back day = 2am PDT / 1am PST, still Nov 1 in LA
    mockNow('2026-11-01T09:00:00Z');
    expect(getTodayInTimezoneSync()).toBe('2026-11-01');
    expect(getTomorrowInTimezoneSync()).toBe('2026-11-02');
  });

  it('today and tomorrow are always exactly one calendar day apart', () => {
    vi.useFakeTimers();
    const testDates = [
      '2026-01-15T12:00:00Z',
      '2026-03-08T12:00:00Z',
      '2026-11-01T12:00:00Z',
      '2026-12-31T12:00:00Z',
    ];
    for (const utc of testDates) {
      mockNow(utc);
      const today = getTodayInTimezoneSync();
      const tomorrow = getTomorrowInTimezoneSync();
      const [ty, tm, td] = today.split('-').map(Number);
      const [ry, rm, rd] = tomorrow.split('-').map(Number);
      const todayMs = Date.UTC(ty, tm - 1, td);
      const tomorrowMs = Date.UTC(ry, rm - 1, rd);
      expect(tomorrowMs - todayMs).toBe(24 * 60 * 60 * 1000);
    }
  });
});
