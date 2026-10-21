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

  it.each([
    ['2026-12-01', 0, '2026-12-01T08:00:00Z'],
    ['2026-01-01', 12, '2025-12-31T20:00:00Z'],
    ['2024-03-01', 24, '2024-02-29T08:00:00Z'],
    ['2026-05-13', 1.5, '2026-05-13T05:30:00Z'],
    ['2026-05-13', 0, '2026-05-13T07:00:00Z'],
  ])('handles month/year/leap boundaries and fractional/zero windows: %s %sh', (day, hours, cutoff) => {
    // Historical/seasonal expectations use the installed IANA data. BC's new
    // permanent-offset policy requires a separate runtime-readiness change.
    const deadline = Date.parse(cutoff);
    expect(getBookingCancellationDeadline(day, 'America/Los_Angeles', hours)).toBe(deadline);
    expect(canCancelBooking(day, 'America/Los_Angeles', hours, new Date(deadline))).toBe(true);
    expect(canCancelBooking(day, 'America/Los_Angeles', hours, new Date(deadline + 1))).toBe(false);
  });

  it.each([
    ['not-a-date', 12], ['2026-02-30', 12], ['2026-13-01', 12],
    ['2026-05-13T00:00:00Z', 12], ['', 12],
    ['2026-05-13', -1], ['2026-05-13', NaN], ['2026-05-13', Infinity],
  ])('fails closed for invalid date/window: %s %s', (day, hours) => {
    expect(canCancelBooking(day, 'America/Vancouver', hours, new Date('2026-01-01'))).toBe(false);
  });

  it('fails closed for an invalid zone or current instant', () => {
    expect(canCancelBooking('2026-05-13', 'Invalid/Zone', 12)).toBe(false);
    expect(canCancelBooking('2026-05-13', 'America/Vancouver', 12, new Date(NaN))).toBe(false);
  });

  it('denies past and same-day bookings after their midnight start', () => {
    const now = new Date('2026-05-13T07:00:01Z');
    expect(canCancelBooking('2026-05-12', 'America/Vancouver', 0, now)).toBe(false);
    expect(canCancelBooking('2026-05-13', 'America/Vancouver', 0, now)).toBe(false);
    expect(canCancelBooking('2026-05-14', 'America/Vancouver', 12, now)).toBe(true);
  });
});
