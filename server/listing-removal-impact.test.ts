/**
 * Unit tests for the booking-selection rule shared by the admin cancel-listing
 * endpoint and the "which renters lose a booking" warning in its confirm dialog.
 *
 * The warning is only trustworthy if it selects exactly the bookings the
 * cancellation will destroy, so these pin the rule itself: terminal statuses are
 * never touched, a removal range is inclusive on both ends, and a missing range
 * means the whole listing.
 */
import { describe, it, expect } from "vitest";
import { selectBookingsAffectedByRemoval } from "./listing-removal-impact";

const booking = (id: string, bookingDate: string, status = "confirmed") => ({
  id,
  bookingDate,
  status,
});

const ids = (rows: { id: string }[]) => rows.map(r => r.id);

describe("selectBookingsAffectedByRemoval", () => {
  // ── Whole-listing cancellation (no range) ────────────────────────────────

  it("returns every non-terminal booking when no removal range is given", () => {
    const rows = [
      booking("a", "2087-08-01"),
      booking("b", "2087-09-15", "pending"),
      booking("c", "2087-10-01", "active"),
    ];
    expect(ids(selectBookingsAffectedByRemoval(rows))).toEqual(["a", "b", "c"]);
  });

  it("treats null/undefined range bounds as a whole-listing cancellation", () => {
    const rows = [booking("a", "2087-08-01")];
    expect(ids(selectBookingsAffectedByRemoval(rows, null, null))).toEqual(["a"]);
    expect(ids(selectBookingsAffectedByRemoval(rows, undefined, undefined))).toEqual(["a"]);
  });

  // ── Terminal statuses ────────────────────────────────────────────────────

  it("excludes cancelled and completed bookings", () => {
    const rows = [
      booking("cancelled", "2087-08-02", "cancelled"),
      booking("completed", "2087-08-02", "completed"),
      booking("confirmed", "2087-08-02", "confirmed"),
    ];
    expect(ids(selectBookingsAffectedByRemoval(rows, "2087-08-02", "2087-08-02"))).toEqual(["confirmed"]);
  });

  it("keeps any status that is not cancelled or completed", () => {
    const rows = [
      booking("pending", "2087-08-02", "pending"),
      booking("active", "2087-08-02", "active"),
      booking("disputed", "2087-08-02", "disputed"),
    ];
    expect(ids(selectBookingsAffectedByRemoval(rows, "2087-08-02"))).toHaveLength(3);
  });

  // ── Single day ───────────────────────────────────────────────────────────

  it("selects only the booking on the removed day", () => {
    const rows = [
      booking("before", "2087-08-01"),
      booking("on", "2087-08-02"),
      booking("after", "2087-08-03"),
    ];
    expect(ids(selectBookingsAffectedByRemoval(rows, "2087-08-02"))).toEqual(["on"]);
  });

  it("returns nothing when the removed day is unbooked", () => {
    const rows = [booking("other", "2087-08-05")];
    expect(selectBookingsAffectedByRemoval(rows, "2087-08-02")).toEqual([]);
  });

  // ── Ranges ───────────────────────────────────────────────────────────────

  it("includes both ends of the removal range", () => {
    const rows = [
      booking("day-before", "2087-08-01"),
      booking("start", "2087-08-02"),
      booking("middle", "2087-08-03"),
      booking("end", "2087-08-04"),
      booking("day-after", "2087-08-05"),
    ];
    expect(ids(selectBookingsAffectedByRemoval(rows, "2087-08-02", "2087-08-04")))
      .toEqual(["start", "middle", "end"]);
  });

  it("falls back to a single day when the end is omitted or empty", () => {
    const rows = [booking("on", "2087-08-02"), booking("later", "2087-08-04")];
    expect(ids(selectBookingsAffectedByRemoval(rows, "2087-08-02", ""))).toEqual(["on"]);
    expect(ids(selectBookingsAffectedByRemoval(rows, "2087-08-02", null))).toEqual(["on"]);
  });

  it("compares dates across month and year boundaries by calendar order", () => {
    const rows = [
      booking("dec", "2087-12-31"),
      booking("jan", "2088-01-01"),
      booking("feb", "2088-02-01"),
    ];
    expect(ids(selectBookingsAffectedByRemoval(rows, "2087-12-31", "2088-01-01")))
      .toEqual(["dec", "jan"]);
  });

  it("normalises Date-valued bookingDate columns before comparing", () => {
    const rows = [
      { id: "on", bookingDate: "2087-08-02", status: "confirmed" },
      { id: "off", bookingDate: "2087-08-09", status: "confirmed" },
    ];
    expect(ids(selectBookingsAffectedByRemoval(rows, "2087-08-01", "2087-08-03"))).toEqual(["on"]);
  });

  it("returns an empty list for a listing with no bookings", () => {
    expect(selectBookingsAffectedByRemoval([], "2087-08-02", "2087-08-04")).toEqual([]);
  });
});
