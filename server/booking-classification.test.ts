import { describe, it, expect } from "vitest";
import { isWorkplaceServicesListing, resolveAdminListingAttribution, isSwapDamagedListing } from "./booking-classification";

const OWNER_ID = "user-devin";
const ADMIN_ID = "user-admin";

describe("isWorkplaceServicesListing", () => {
  it("classifies admin-created listing on ownerless BCI spot as Workplace Services", () => {
    expect(
      isWorkplaceServicesListing(
        { createdByAdmin: true },
        { ownerId: null, isBciManaged: true }
      )
    ).toBe(true);
  });

  it("individually-owned spot is ALWAYS peer-to-peer, even with admin-created listing (swap scenario)", () => {
    // This is the exact prod incident: spot re-assigned to owner, listings
    // re-created with createdByAdmin=true and spot left isBciManaged=true.
    expect(
      isWorkplaceServicesListing(
        { createdByAdmin: true },
        { ownerId: OWNER_ID, isBciManaged: true }
      )
    ).toBe(false);
  });

  it("individually-owned spot with normal P2P listing is peer-to-peer", () => {
    expect(
      isWorkplaceServicesListing(
        { createdByAdmin: false },
        { ownerId: OWNER_ID, isBciManaged: false }
      )
    ).toBe(false);
  });

  it("ownerless spot with peer listing is peer-to-peer", () => {
    expect(
      isWorkplaceServicesListing(
        { createdByAdmin: false },
        { ownerId: null, isBciManaged: false }
      )
    ).toBe(false);
  });

  it("no listing (direct assignment) on BCI pool spot is Workplace Services", () => {
    expect(
      isWorkplaceServicesListing(null, { ownerId: null, isBciManaged: true })
    ).toBe(true);
  });

  it("no listing on individually-owned spot is peer-to-peer", () => {
    expect(
      isWorkplaceServicesListing(null, { ownerId: OWNER_ID, isBciManaged: true })
    ).toBe(false);
  });

  it("no listing and no spot context defaults to peer-to-peer", () => {
    expect(isWorkplaceServicesListing(null, null)).toBe(false);
  });

  it("missing spot context falls back to listing flag", () => {
    expect(isWorkplaceServicesListing({ createdByAdmin: true }, null)).toBe(true);
    expect(isWorkplaceServicesListing({ createdByAdmin: false }, null)).toBe(false);
  });
});

describe("isSwapDamagedListing (startup repair scope)", () => {
  it("active admin-created listing on an individually-owned spot IS swap damage", () => {
    expect(
      isSwapDamagedListing({ createdByAdmin: true, deletedAt: null }, { ownerId: OWNER_ID })
    ).toBe(true);
  });

  it("soft-deleted admin-created listing is NEVER repaired (prior owner / pool-era history preserved after a legitimate reassignment)", () => {
    expect(
      isSwapDamagedListing(
        { createdByAdmin: true, deletedAt: new Date("2026-08-17") },
        { ownerId: "new-owner-after-reassignment" }
      )
    ).toBe(false);
  });

  it("active owner-created listing is not touched", () => {
    expect(
      isSwapDamagedListing({ createdByAdmin: false, deletedAt: null }, { ownerId: OWNER_ID })
    ).toBe(false);
  });

  it("admin-created listing on an ownerless (pool) spot is legitimate WPS, not damage", () => {
    expect(
      isSwapDamagedListing({ createdByAdmin: true, deletedAt: null }, { ownerId: null })
    ).toBe(false);
    expect(isSwapDamagedListing({ createdByAdmin: true, deletedAt: null }, null)).toBe(false);
  });
});

describe("resolveAdminListingAttribution", () => {
  it("admin-created listing on ownerless spot is attributed to admin and flagged admin-created", () => {
    expect(resolveAdminListingAttribution({ ownerId: null }, ADMIN_ID)).toEqual({
      ownerId: ADMIN_ID,
      createdByAdmin: true,
    });
  });

  it("listing re-created on individually-owned spot keeps owner attribution and is NOT admin-created", () => {
    // Swap regression: re-created listings must not be stamped admin-created.
    expect(resolveAdminListingAttribution({ ownerId: OWNER_ID }, ADMIN_ID)).toEqual({
      ownerId: OWNER_ID,
      createdByAdmin: false,
    });
  });

  it("missing spot defaults to admin attribution", () => {
    expect(resolveAdminListingAttribution(null, ADMIN_ID)).toEqual({
      ownerId: ADMIN_ID,
      createdByAdmin: true,
    });
  });
});
