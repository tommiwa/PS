/**
 * The admin cancel-listing dialog warns which renters lose a booking before the
 * admin confirms. A warning the admin can click past is not a warning, so these
 * pin the gate: confirmation is blocked while the check is in flight, after it
 * fails, and while the loaded answer still describes the previous day/range.
 */
import { describe, it, expect } from "vitest";
import {
  isCancelImpactCurrent,
  canConfirmCancelListing,
  type CancelImpactSelection,
  type CancelImpactResult,
} from "./cancel-listing-impact";

const LISTING = "listing-1";

const selection = (overrides: Partial<CancelImpactSelection> = {}): CancelImpactSelection => ({
  listingId: LISTING,
  startDate: "2087-08-02",
  endDate: "2087-08-02",
  ...overrides,
});

const answer = (overrides: Partial<CancelImpactResult> = {}): CancelImpactResult => ({
  listingId: LISTING,
  startDate: "2087-08-02",
  endDate: "2087-08-02",
  ...overrides,
});

const settled = (data?: CancelImpactResult | null) => ({ data, isFetching: false, isError: false });

describe("isCancelImpactCurrent", () => {
  it("accepts a settled answer for exactly the selected day", () => {
    expect(isCancelImpactCurrent(selection(), settled(answer()))).toBe(true);
  });

  it("accepts a settled answer for exactly the selected range", () => {
    expect(isCancelImpactCurrent(
      selection({ endDate: "2087-08-05" }),
      settled(answer({ endDate: "2087-08-05" })),
    )).toBe(true);
  });

  it("accepts a settled whole-listing answer when no days are selected", () => {
    expect(isCancelImpactCurrent(
      selection({ startDate: null, endDate: null }),
      settled(answer({ startDate: null, endDate: null })),
    )).toBe(true);
  });

  // ── In flight ────────────────────────────────────────────────────────────

  it("rejects while a check is in flight, even with a previous answer loaded", () => {
    expect(isCancelImpactCurrent(selection(), { data: answer(), isFetching: true, isError: false })).toBe(false);
  });

  it("rejects before the first answer arrives", () => {
    expect(isCancelImpactCurrent(selection(), settled(undefined))).toBe(false);
    expect(isCancelImpactCurrent(selection(), settled(null))).toBe(false);
  });

  // ── Failure ──────────────────────────────────────────────────────────────

  it("rejects when the check failed, even if a matching answer is cached", () => {
    expect(isCancelImpactCurrent(selection(), { data: answer(), isFetching: false, isError: true })).toBe(false);
  });

  // ── Stale answers ────────────────────────────────────────────────────────

  it("rejects an answer for the previous range after the admin widens the removal", () => {
    // Admin extended through Aug 5; the loaded answer still covers Aug 2 only.
    expect(isCancelImpactCurrent(selection({ endDate: "2087-08-05" }), settled(answer()))).toBe(false);
  });

  it("rejects an answer for the previous start day", () => {
    expect(isCancelImpactCurrent(selection({ startDate: "2087-08-03" }), settled(answer()))).toBe(false);
  });

  it("rejects a day-scoped answer once the admin switches to cancelling the whole listing", () => {
    expect(isCancelImpactCurrent(selection({ startDate: null, endDate: null }), settled(answer()))).toBe(false);
  });

  it("rejects a whole-listing answer once the admin switches back to a single day", () => {
    expect(isCancelImpactCurrent(selection(), settled(answer({ startDate: null, endDate: null })))).toBe(false);
  });

  it("rejects an answer that belongs to a different listing", () => {
    expect(isCancelImpactCurrent(selection(), settled(answer({ listingId: "listing-2" })))).toBe(false);
  });

  it("rejects when no listing is selected yet", () => {
    expect(isCancelImpactCurrent(selection({ listingId: undefined }), settled(answer()))).toBe(false);
  });
});

describe("canConfirmCancelListing", () => {
  it("allows confirmation once a reason is given and the impact is known", () => {
    expect(canConfirmCancelListing({ hasReason: true, isSubmitting: false, impactIsCurrent: true })).toBe(true);
  });

  it("blocks confirmation while the renter impact is unknown or stale", () => {
    expect(canConfirmCancelListing({ hasReason: true, isSubmitting: false, impactIsCurrent: false })).toBe(false);
  });

  it("still requires a cancellation reason", () => {
    expect(canConfirmCancelListing({ hasReason: false, isSubmitting: false, impactIsCurrent: true })).toBe(false);
  });

  it("blocks a second submit while one is already running", () => {
    expect(canConfirmCancelListing({ hasReason: true, isSubmitting: true, impactIsCurrent: true })).toBe(false);
  });
});
