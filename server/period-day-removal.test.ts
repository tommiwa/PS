/**
 * Database-backed regression tests for removing individual days from a period
 * listing (storage.removeDatesFromPeriodListing).
 *
 * Before this existed, cancelling one expanded day of a period in the admin
 * Booking Availability tab cancelled the whole underlying period record. These
 * tests pin the splitting behaviour: the removed day(s) disappear, every other
 * day of the period stays available with the original pricing/attribution, and
 * bookings on surviving days keep resolving to a live listing.
 *
 * They run against the development database; fixtures use a "pdrtest-" prefix
 * and are removed in afterAll.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage, PeriodRemovalError, shiftDateString, enumerateDateRange } from "./storage";

const P = "pdrtest";
const SPOT = `${P}-spot-1`;
const OWNER = `${P}-user-owner`;
const RENTER = `${P}-user-renter`;
const PERIOD_ID = `${P}-lst-period`;

// Fixed future dates keep the fixtures stable regardless of when the suite runs.
const PERIOD_START = "2087-08-01";
const PERIOD_END = "2087-12-31";

async function cleanup() {
  await db.execute(sql.raw(`
    DELETE FROM bookings WHERE id LIKE '${P}-bkg-%' OR spot_id = '${SPOT}';
    DELETE FROM spot_listings WHERE id LIKE '${P}-lst-%' OR spot_id = '${SPOT}';
    DELETE FROM parking_spots WHERE id = '${SPOT}';
    DELETE FROM users WHERE id LIKE '${P}-user-%';
  `));
}

/** Recreate the Aug 1 – Dec 31 period record under test. */
async function seedPeriodListing(overrides: { start?: string; end?: string } = {}) {
  const start = overrides.start ?? PERIOD_START;
  const end = overrides.end ?? PERIOD_END;
  await db.execute(sql.raw(`
    DELETE FROM bookings WHERE spot_id = '${SPOT}';
    DELETE FROM spot_listings WHERE spot_id = '${SPOT}';
    INSERT INTO spot_listings
      (id, spot_id, owner_id, listing_type, period_start_date, period_end_date, daily_rate, status,
       notes, donate_to_charity, created_by_admin, original_daily_rate, sale_calendar_label,
       sale_calendar_color, sale_start_date, sale_end_date)
    VALUES
      ('${PERIOD_ID}', '${SPOT}', '${OWNER}', 'period', '${start}', '${end}', 12.50, 'available',
       'Owner notes', true, true, 20.00, 'Fall Sale', 'green', '${start}', '${end}');
  `));
}

/** Live (available, not soft-deleted) listings on the fixture spot, oldest date first. */
async function activeListings(): Promise<any[]> {
  const result = await db.execute(sql.raw(`
    SELECT id, listing_type, single_date::text AS single_date,
           period_start_date::text AS period_start_date, period_end_date::text AS period_end_date,
           status, deleted_at, daily_rate, notes, owner_id, donate_to_charity, created_by_admin,
           original_listing_type, original_daily_rate, sale_calendar_label, sale_calendar_color,
           sale_start_date, sale_end_date
    FROM spot_listings
    WHERE spot_id = '${SPOT}' AND deleted_at IS NULL AND status = 'available'
    ORDER BY COALESCE(period_start_date, single_date)
  `));
  return result.rows as any[];
}

async function listingRow(id: string): Promise<any> {
  const result = await db.execute(sql.raw(`
    SELECT id, status, deleted_at, admin_notes FROM spot_listings WHERE id = '${id}'
  `));
  return (result.rows as any[])[0];
}

async function bookingRow(id: string): Promise<any> {
  const result = await db.execute(sql.raw(`
    SELECT id, listing_id, status, booking_date::text AS booking_date FROM bookings WHERE id = '${id}'
  `));
  return (result.rows as any[])[0];
}

async function insertBooking(id: string, date: string, listingId: string, status = "confirmed") {
  await db.execute(sql.raw(`
    INSERT INTO bookings (id, listing_id, spot_id, renter_id, owner_id, booking_date, daily_rate, total_amount, status)
    VALUES ('${id}', '${listingId}', '${SPOT}', '${RENTER}', '${OWNER}', '${date}', 12.50, 12.50, '${status}');
  `));
}

/** Availability coverage of the live listings, as a flat set of dates. */
async function availableDates(): Promise<Set<string>> {
  const dates = new Set<string>();
  for (const row of await activeListings()) {
    if (row.listing_type === 'single') {
      dates.add(row.single_date);
    } else {
      for (const d of enumerateDateRange(row.period_start_date, row.period_end_date)) dates.add(d);
    }
  }
  return dates;
}

beforeAll(async () => {
  await cleanup();
  await db.execute(sql.raw(`
    INSERT INTO users (id, email, first_name, last_name) VALUES
      ('${OWNER}', '${P}-owner@test.local', 'Pat', 'Owner'),
      ('${RENTER}', '${P}-renter@test.local', 'Robin', 'Renter');

    INSERT INTO parking_spots (id, spot_number, owner_id, is_bci_managed, location_id, spot_type_id)
    SELECT '${SPOT}', 'PDR1', '${OWNER}', false, (SELECT id FROM locations LIMIT 1), (SELECT id FROM spot_types LIMIT 1);
  `));
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await seedPeriodListing();
});

describe("removeDatesFromPeriodListing", () => {
  it("removes a day from the middle and keeps both surrounding segments available", async () => {
    const result = await storage.removeDatesFromPeriodListing(PERIOD_ID, "2087-09-23", "2087-09-23", "Owner needs the spot");

    expect(result.outcome).toBe("split");
    expect(result.removedDates).toEqual(["2087-09-23"]);
    expect(result.replacements).toHaveLength(2);

    const live = await activeListings();
    expect(live.map(l => [l.period_start_date, l.period_end_date])).toEqual([
      [PERIOD_START, "2087-09-22"],
      ["2087-09-24", PERIOD_END],
    ]);

    // Original record retired: cancelled and soft-deleted so it stops appearing anywhere.
    const original = await listingRow(PERIOD_ID);
    expect(original.status).toBe("cancelled");
    expect(original.deleted_at).not.toBeNull();
    expect(String(original.admin_notes)).toContain("Owner needs the spot");

    // Pricing, notes, attribution and sale pricing survive on both segments.
    for (const row of live) {
      expect(Number(row.daily_rate)).toBe(12.5);
      expect(row.notes).toBe("Owner notes");
      expect(row.owner_id).toBe(OWNER);
      expect(row.donate_to_charity).toBe(true);
      expect(row.created_by_admin).toBe(true);
      expect(row.original_listing_type).toBe("period");
      expect(Number(row.original_daily_rate)).toBe(20);
      expect(row.sale_calendar_label).toBe("Fall Sale");
      expect(row.sale_calendar_color).toBe("green");
      expect(row.sale_start_date).toBe(PERIOD_START);
      expect(row.sale_end_date).toBe(PERIOD_END);
    }

    const dates = await availableDates();
    expect(dates.has("2087-09-23")).toBe(false);
    expect(dates.has("2087-09-22")).toBe(true);
    expect(dates.has("2087-09-24")).toBe(true);
    expect(dates.has(PERIOD_START)).toBe(true);
    expect(dates.has(PERIOD_END)).toBe(true);
  });

  it("removes Sep 23, 24 and 25 one at a time, leaving Aug 1–Sep 22 and Sep 26–Dec 31", async () => {
    for (const date of ["2087-09-23", "2087-09-24", "2087-09-25"]) {
      const covering = (await activeListings()).find(l =>
        l.listing_type === 'period' && date >= l.period_start_date && date <= l.period_end_date
      );
      expect(covering, `no live listing covers ${date}`).toBeTruthy();
      await storage.removeDatesFromPeriodListing(covering.id, date, date, "Reserved for maintenance");
    }

    const live = await activeListings();
    expect(live.map(l => [l.period_start_date, l.period_end_date])).toEqual([
      [PERIOD_START, "2087-09-22"],
      ["2087-09-26", PERIOD_END],
    ]);

    const dates = await availableDates();
    expect(["2087-09-23", "2087-09-24", "2087-09-25"].some(d => dates.has(d))).toBe(false);
    expect(dates.size).toBe(enumerateDateRange(PERIOD_START, PERIOD_END).length - 3);
  });

  it("removes the first day of the period", async () => {
    const result = await storage.removeDatesFromPeriodListing(PERIOD_ID, PERIOD_START, PERIOD_START, "First day gone");

    expect(result.outcome).toBe("split");
    expect(result.replacements).toHaveLength(1);
    const live = await activeListings();
    expect(live).toHaveLength(1);
    expect(live[0].listing_type).toBe("period");
    expect(live[0].period_start_date).toBe(shiftDateString(PERIOD_START, 1));
    expect(live[0].period_end_date).toBe(PERIOD_END);
  });

  it("removes the last day of the period", async () => {
    const result = await storage.removeDatesFromPeriodListing(PERIOD_ID, PERIOD_END, PERIOD_END, "Last day gone");

    expect(result.outcome).toBe("split");
    expect(result.replacements).toHaveLength(1);
    const live = await activeListings();
    expect(live).toHaveLength(1);
    expect(live[0].period_start_date).toBe(PERIOD_START);
    expect(live[0].period_end_date).toBe(shiftDateString(PERIOD_END, -1));
  });

  it("removes a consecutive range of days in one action", async () => {
    const result = await storage.removeDatesFromPeriodListing(PERIOD_ID, "2087-09-23", "2087-09-25", "Building closed");

    expect(result.removedDates).toEqual(["2087-09-23", "2087-09-24", "2087-09-25"]);
    const live = await activeListings();
    expect(live.map(l => [l.period_start_date, l.period_end_date])).toEqual([
      [PERIOD_START, "2087-09-22"],
      ["2087-09-26", PERIOD_END],
    ]);
  });

  it("collapses a one-day surviving segment into a single-day listing", async () => {
    await seedPeriodListing({ start: "2087-08-01", end: "2087-08-02" });

    const result = await storage.removeDatesFromPeriodListing(PERIOD_ID, "2087-08-02", "2087-08-02", "Second day gone");

    expect(result.outcome).toBe("split");
    const live = await activeListings();
    expect(live).toHaveLength(1);
    expect(live[0].listing_type).toBe("single");
    expect(live[0].single_date).toBe("2087-08-01");
    // Original period bounds are kept for provenance, matching the booking-time split.
    expect(live[0].period_start_date).toBe("2087-08-01");
    expect(live[0].period_end_date).toBe("2087-08-02");
    expect(live[0].original_listing_type).toBe("period");
  });

  it("cancels the listing outright when the only remaining day is removed", async () => {
    await seedPeriodListing({ start: "2087-08-01", end: "2087-08-01" });

    const result = await storage.removeDatesFromPeriodListing(PERIOD_ID, "2087-08-01", "2087-08-01", "No longer available");

    expect(result.outcome).toBe("full_cancel");
    expect(result.replacements).toHaveLength(0);
    expect(await activeListings()).toHaveLength(0);

    // Cancelled exactly like a whole-listing cancellation: no soft delete.
    const original = await listingRow(PERIOD_ID);
    expect(original.status).toBe("cancelled");
    expect(original.deleted_at).toBeNull();
    expect(original.admin_notes).toBe("No longer available");
  });

  it("re-points a booking on a surviving day and leaves bookings in the removed range for the caller", async () => {
    await insertBooking(`${P}-bkg-survivor`, "2087-10-05", PERIOD_ID);
    await insertBooking(`${P}-bkg-removed`, "2087-09-23", PERIOD_ID);
    await insertBooking(`${P}-bkg-cancelled`, "2087-11-01", PERIOD_ID, "cancelled");

    const result = await storage.removeDatesFromPeriodListing(PERIOD_ID, "2087-09-23", "2087-09-23", "Spot needed");

    const afterSegment = result.replacements.find(r => r.periodStartDate === "2087-09-24");
    expect(afterSegment).toBeTruthy();

    const survivor = await bookingRow(`${P}-bkg-survivor`);
    expect(survivor.listing_id).toBe(afterSegment!.id);
    expect(survivor.status).toBe("confirmed");
    expect(result.repointedBookings).toEqual([
      { bookingId: `${P}-bkg-survivor`, bookingDate: "2087-10-05", listingId: afterSegment!.id },
    ]);

    // The booking on the removed day is untouched here — the route cancels and notifies it.
    const removed = await bookingRow(`${P}-bkg-removed`);
    expect(removed.listing_id).toBe(PERIOD_ID);
    expect(removed.status).toBe("confirmed");

    // Cancelled bookings keep pointing at the (soft-deleted) original for history.
    const cancelled = await bookingRow(`${P}-bkg-cancelled`);
    expect(cancelled.listing_id).toBe(PERIOD_ID);
  });

  it("rejects dates outside the period without touching the listing", async () => {
    await expect(
      storage.removeDatesFromPeriodListing(PERIOD_ID, "2088-01-05", "2088-01-05", "Outside")
    ).rejects.toThrow(PeriodRemovalError);

    await expect(
      storage.removeDatesFromPeriodListing(PERIOD_ID, "2087-12-30", "2088-01-02", "Runs past the end")
    ).rejects.toThrow(/inside the listing period/);

    await expect(
      storage.removeDatesFromPeriodListing(PERIOD_ID, "2087-09-25", "2087-09-23", "Backwards")
    ).rejects.toThrow(/on or after/);

    const original = await listingRow(PERIOD_ID);
    expect(original.status).toBe("available");
    expect(original.deleted_at).toBeNull();
    expect(await activeListings()).toHaveLength(1);
  });

  it("rejects a second removal against a record that was already split", async () => {
    await storage.removeDatesFromPeriodListing(PERIOD_ID, "2087-09-23", "2087-09-23", "First removal");

    await expect(
      storage.removeDatesFromPeriodListing(PERIOD_ID, "2087-09-23", "2087-09-23", "Same day again")
    ).rejects.toThrow(/no longer active/);

    // The surviving segments from the first removal are intact.
    expect(await activeListings()).toHaveLength(2);
  });

  it("rejects per-day removal on a non-period listing", async () => {
    await db.execute(sql.raw(`
      INSERT INTO spot_listings (id, spot_id, owner_id, listing_type, single_date, daily_rate, status)
      VALUES ('${P}-lst-single', '${SPOT}', '${OWNER}', 'single', '2087-09-23', 12.50, 'available');
    `));

    await expect(
      storage.removeDatesFromPeriodListing(`${P}-lst-single`, "2087-09-23", "2087-09-23", "Nope")
    ).rejects.toThrow(/Only period listings/);
  });

  it("still cancels the whole listing when no dates are supplied", async () => {
    const cancelled = await storage.cancelSpotListing(PERIOD_ID, "Whole period cancelled");

    expect(cancelled?.status).toBe("cancelled");
    expect(await activeListings()).toHaveLength(0);
    const original = await listingRow(PERIOD_ID);
    expect(original.admin_notes).toBe("Whole period cancelled");
    expect(original.deleted_at).toBeNull();
  });
});
