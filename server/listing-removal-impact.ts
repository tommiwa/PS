/**
 * Which bookings a listing cancellation / per-day removal will destroy.
 *
 * The admin cancel dialog warns about the renters that are about to lose their
 * booking, and the cancel endpoint then actually cancels them. Both must agree
 * exactly — a warning that disagrees with the action is worse than no warning —
 * so the selection rule lives here and is used by both.
 */

/** Statuses that are already terminal: cancelling the listing does not touch them. */
const TERMINAL_BOOKING_STATUSES = new Set(["cancelled", "completed"]);

export interface BookingLikeForRemoval {
  bookingDate: unknown;
  status: string;
}

/**
 * Bookings on `listingBookings` that a removal would cancel.
 *
 * With no removal range (a whole-listing cancellation) every non-terminal
 * booking is affected. With a range only the non-terminal bookings whose date
 * falls inside `[removalStart, removalEnd]` are — bookings on surviving days
 * get re-pointed at the replacement listings instead.
 *
 * Dates are compared as `YYYY-MM-DD` strings, which sort lexicographically.
 */
export function selectBookingsAffectedByRemoval<T extends BookingLikeForRemoval>(
  listingBookings: T[],
  removalStart?: string | null,
  removalEnd?: string | null,
): T[] {
  const active = listingBookings.filter(b => !TERMINAL_BOOKING_STATUSES.has(b.status));

  if (!removalStart) {
    return active;
  }

  const end = removalEnd || removalStart;
  return active.filter(b => {
    const bookingDate = String(b.bookingDate);
    return bookingDate >= removalStart && bookingDate <= end;
  });
}
