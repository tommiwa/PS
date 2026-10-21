import { describe, it, expect } from 'vitest';
import { canCancelBooking, getBookingCancellationDeadline } from '../shared/booking-cancellation';

describe('parking-timezone cancellation cutoff', () => {
  it('reproduces the false UTC-host denial at 10:13 BC, with 13h47m remaining', () => {
    const now = new Date('2026-05-12T17:13:00Z');
    const midnight = getBookingCancellationDeadline('2026-05-13', 'America/Vancouver', 0);
    expect((midnight - now.getTime()) / 60000).toBe(13 * 60 + 47);
    expect((Date.parse('2026-05-13T00:00:00Z') - now.getTime()) / 60000).toBe(6 * 60 + 47);
    expect(canCancelBooking('2026-05-13', 'America/Vancouver', 12, now)).toBe(true);
  });

  it.each([
    ['2026-05-13', 12, '2026-05-12T19:00:00Z'],
    ['2026-05-13', 24, '2026-05-12T07:00:00Z'],
    // Historical spring day has 23 elapsed hours; fall day has 25.
    ['2025-03-10', 24, '2025-03-09T07:00:00Z'],
    ['2025-11-03', 24, '2025-11-02T08:00:00Z'],
    ['2025-01-16', 12, '2025-01-15T20:00:00Z'],
  ])('%s / %ih cutoff preserves historical rules and the exact boundary', (day, hours, cutoff) => {
    const ms = Date.parse(cutoff);
    expect(getBookingCancellationDeadline(day, 'America/Vancouver', hours)).toBe(ms);
    expect(canCancelBooking(day, 'America/Vancouver', hours, new Date(ms - 1))).toBe(true);
    expect(canCancelBooking(day, 'America/Vancouver', hours, new Date(ms))).toBe(true);
    expect(canCancelBooking(day, 'America/Vancouver', hours, new Date(ms + 1))).toBe(false);
  });

  it.each(['UTC', 'America/Vancouver', 'Asia/Tokyo', 'Pacific/Auckland'])(
    'does not depend on server/device local timezone %s', (hostTimezone) => {
      const original = process.env.TZ;
      try {
        process.env.TZ = hostTimezone;
        expect(getBookingCancellationDeadline('2026-05-13', 'America/Vancouver', 12))
          .toBe(Date.parse('2026-05-12T19:00:00Z'));
        expect(canCancelBooking('2026-05-13', 'America/Vancouver', 12, new Date('2026-05-12T17:13:00Z')))
          .toBe(true);
      } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
      }
    },
  );

  it('honours a non-Pacific configured parking zone', () => {
    expect(getBookingCancellationDeadline('2026-05-13', 'Asia/Tokyo', 12))
      .toBe(Date.parse('2026-05-12T03:00:00Z'));
  });
});
