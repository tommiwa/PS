import { db } from "./db";
import { spotListings } from "@shared/schema";
import { and, eq, or, isNull, sql } from "drizzle-orm";
import { sendFullOccupancyNotification } from "./notification-service";
import { getTodayInTimezone } from "./timezone";

export const MAX_FUTURE_MONTHS = 6;

export function getListingDates(listing: {
  listingType: string;
  singleDate?: string | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  recurringStartDate?: string | null;
  recurringEndDate?: string | null;
  daysOfWeek?: number[] | null;
}): string[] {
  const dates: string[] = [];

  if (listing.listingType === 'single' && listing.singleDate) {
    dates.push(listing.singleDate);
  } else if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
    const start = new Date(listing.periodStartDate);
    const end = new Date(listing.periodEndDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
  } else if (listing.listingType === 'recurring' && listing.recurringStartDate && listing.daysOfWeek?.length) {
    const start = new Date(listing.recurringStartDate);
    const maxFutureDate = new Date();
    maxFutureDate.setMonth(maxFutureDate.getMonth() + MAX_FUTURE_MONTHS);
    const end = listing.recurringEndDate
      ? new Date(Math.min(new Date(listing.recurringEndDate).getTime(), maxFutureDate.getTime()))
      : maxFutureDate;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (listing.daysOfWeek.includes(dayOfWeek)) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }
  }

  return dates;
}

export async function checkOccupancyForDate(date: string): Promise<{ isFull: boolean; totalBooked: number }> {
  const candidates = await db
    .select()
    .from(spotListings)
    .where(
      and(
        isNull(spotListings.deletedAt),
        or(
          and(
            eq(spotListings.listingType, 'single'),
            eq(spotListings.singleDate, date)
          ),
          and(
            eq(spotListings.listingType, 'period'),
            sql`${spotListings.periodStartDate} <= ${date}`,
            sql`${spotListings.periodEndDate} >= ${date}`
          ),
          and(
            eq(spotListings.listingType, 'recurring'),
            sql`${spotListings.recurringStartDate} <= ${date}`,
            or(
              isNull(spotListings.recurringEndDate),
              sql`${spotListings.recurringEndDate} >= ${date}`
            )
          )
        )
      )
    );

  const listingsForDate = candidates.filter(listing =>
    listing.listingType !== 'recurring' || getListingDates(listing).includes(date)
  );

  if (listingsForDate.length === 0) {
    return { isFull: false, totalBooked: 0 };
  }

  const hasAvailable = listingsForDate.some(l => l.status === 'available');
  const totalBooked = listingsForDate.filter(l => l.status === 'booked').length;

  return { isFull: !hasAvailable && totalBooked > 0, totalBooked };
}

export type UserForOccupancy = {
  roles: string[];
  email: string | null;
  status: string;
};

/**
 * Orchestrates the full-house email notification flow for a booking date.
 *
 * - Queries the DB to check whether all listings for the date are booked.
 * - Calls `claimNotification(date)` to atomically acquire the send-right
 *   (exactly one concurrent caller wins; fail-closed on error).
 * - If claimed, dispatches the email to the WPS address plus all active admins.
 *
 * Accepting `claimNotification` and `getAllUsers` as parameters makes this
 * function fully injectable and unit-testable without a live database.
 */
export async function maybeNotifyFullOccupancy(
  date: string,
  getAllUsers: () => Promise<UserForOccupancy[]>,
  workplaceServicesEmail: string,
  claimNotification: (date: string) => Promise<boolean>,
): Promise<void> {
  const today = await getTodayInTimezone();
  if (date !== today) return;

  const { isFull, totalBooked } = await checkOccupancyForDate(date);
  if (!isFull) return;

  const claimed = await claimNotification(date);
  if (!claimed) return;

  const allUsers = await getAllUsers();
  const adminEmails = allUsers
    .filter(u => u.roles.includes('admin') && u.email && u.status === 'active')
    .map(u => u.email as string);

  const recipients = Array.from(new Set([workplaceServicesEmail, ...adminEmails]));

  await sendFullOccupancyNotification(date, totalBooked, recipients);
}
