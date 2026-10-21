import { fromZonedTime } from 'date-fns-tz';

/**
 * A booking day is a calendar date in the parking timezone, not host/device
 * midnight. Subtract elapsed hours from that instant (including across DST).
 */
export function getBookingCancellationDeadline(
  bookingDate: string,
  timezone: string,
  windowHours: number,
): number {
  const midnight = fromZonedTime(`${bookingDate}T00:00:00`, timezone);
  return midnight.getTime() - windowHours * 60 * 60 * 1000;
}

/** Exactly at the cutoff is allowed; invalid inputs cannot grant cancellation. */
export function canCancelBooking(
  bookingDate: string,
  timezone: string,
  windowHours: number,
  now: Date = new Date(),
): boolean {
  return now.getTime() <= getBookingCancellationDeadline(bookingDate, timezone, windowHours);
}
