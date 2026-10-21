import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.hoisted(() => { process.env.REPLIT_DOMAINS ||= "test.example.invalid"; });
vi.mock("./db", () => ({ db: {}, pool: { on: vi.fn() } }));
vi.mock("./storage", () => ({
  storage: {
    getBooking: vi.fn(), cancelBookingWithReason: vi.fn(), updateSpotListingStatus: vi.fn(),
    getAppConfigValue: vi.fn(), getUser: vi.fn(), getSpotListing: vi.fn(),
    getParkingSpot: vi.fn(), getLocation: vi.fn(), getNotificationPreferences: vi.fn(),
    deleteInternalConfigsBefore: vi.fn(async () => 0),
    getAllTermsVersions: vi.fn(async () => [{ version: 1 }]),
    getActiveTermsVersion: vi.fn(async () => ({ version: 1 })),
  },
}));
vi.mock("./replitAuth", async (original) => ({
  ...await original<typeof import("./replitAuth")>(),
  setupAuth: vi.fn(async () => undefined),
}));
vi.mock("./websocket", () => ({ broadcastLockEvent: vi.fn() }));
vi.mock("./audit-middleware", () => ({
  auditContextMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  auditResponseMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  auditErrorMiddleware: (_err: unknown, _req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("./notification-service");
vi.mock("./audit-service");
vi.mock("./audit-storage");
vi.mock("./reports-controller");
vi.mock("./report-service");
vi.mock("./timezone");

import { storage } from "./storage";
import { auditService } from "./audit-service";
import { getConfiguredTimezone } from "./timezone";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  const id = req.headers["x-test-user"];
  req.isAuthenticated = () => !!id;
  if (id) req.user = { claims: { sub: id }, expires_at: Math.floor(Date.now() / 1000) + 3600 };
  next();
});

const booking = {
  id: "cancellation-test", renterId: "renter", spotId: "spot", listingId: "listing",
  bookingDate: "2026-05-13", status: "confirmed", paymentStatus: "pending",
};
beforeAll(async () => {
  const timer = vi.spyOn(globalThis, "setInterval").mockReturnValue({} as ReturnType<typeof setInterval>);
  try { await registerRoutes(app); } finally { timer.mockRestore(); }
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-05-12T17:13:00Z"));
  vi.mocked(storage.getBooking).mockResolvedValue({ ...booking } as any);
  vi.mocked(storage.cancelBookingWithReason).mockResolvedValue({ ...booking, status: "cancelled" } as any);
  vi.mocked(storage.getAppConfigValue).mockResolvedValue("12");
  vi.mocked(getConfiguredTimezone).mockResolvedValue("America/Vancouver");
});
afterEach(() => vi.useRealTimers());
afterAll(() => vi.restoreAllMocks());

function cancel(user: string | null = "renter") {
  const call = request(app).post("/api/bookings/cancellation-test/cancel");
  return user ? call.set("x-test-user", user) : call;
}
function expectNoCancellation() {
  expect(storage.cancelBookingWithReason).not.toHaveBeenCalled();
  expect(storage.updateSpotListingStatus).not.toHaveBeenCalled();
  expect(auditService.logAction).not.toHaveBeenCalled();
}

describe("renter cancellation API uses the parking cutoff and protects booking data", () => {
  it.each([
    ["before", "2026-05-12T18:59:59.999Z", 200],
    ["exactly at", "2026-05-12T19:00:00.000Z", 200],
    ["after", "2026-05-12T19:00:00.001Z", 400],
  ])("%s the BC cutoff (%s) returns %s", async (_label, instant, status) => {
    vi.setSystemTime(new Date(instant));
    const res = await cancel();
    expect(res.status).toBe(status);
    if (status === 200) {
      expect(res.body.status).toBe("cancelled");
      expect(storage.cancelBookingWithReason).toHaveBeenCalledWith(booking.id, "Cancelled by renter");
      expect(storage.updateSpotListingStatus).toHaveBeenCalledWith("listing", "available");
      expect(auditService.logAction).toHaveBeenCalledWith("CANCEL", "booking", expect.objectContaining({ entityId: booking.id }));
    } else expectNoCancellation();
  });

  it("allows cancellation at 10:13 BC even though UTC midnight is less than 12 hours away", async () => {
    expect((await cancel()).status).toBe(200);
  });
  it("rejects unauthenticated callers", async () => {
    expect((await cancel(null)).status).toBe(401);
    expectNoCancellation();
  });
  it("does not let another renter cancel this booking", async () => {
    expect((await cancel("other-renter")).status).toBe(403);
    expectNoCancellation();
  });
  it("returns 404 for a missing booking", async () => {
    vi.mocked(storage.getBooking).mockResolvedValue(undefined);
    expect((await cancel()).status).toBe(404);
    expectNoCancellation();
  });
  it.each([
    { status: "cancelled", paymentStatus: "pending" },
    { status: "completed", paymentStatus: "received" },
    { status: "confirmed", paymentStatus: "received" },
  ])("rejects a terminal booking: %s", async (state) => {
    vi.mocked(storage.getBooking).mockResolvedValue({ ...booking, ...state } as any);
    expect((await cancel()).status).toBe(400);
    expectNoCancellation();
  });
  it.each(["-1", "not-a-number", "Infinity"])("invalid window %s cannot allow cancellation", async config => {
    vi.mocked(storage.getAppConfigValue).mockResolvedValue(config);
    expect((await cancel()).status).toBe(400);
    expectNoCancellation();
  });
  it("uses 24 hours when no window is configured", async () => {
    vi.mocked(storage.getAppConfigValue).mockResolvedValue(undefined);
    expect((await cancel()).status).toBe(400);
    expectNoCancellation();
  });
  it("honours a configured zero-hour cutoff", async () => {
    vi.mocked(storage.getAppConfigValue).mockResolvedValue("0");
    vi.setSystemTime(new Date("2026-05-13T06:59:59Z"));
    expect((await cancel()).status).toBe(200);
  });
  it("uses the configured zone rather than assuming Pacific", async () => {
    vi.mocked(getConfiguredTimezone).mockResolvedValue("Asia/Tokyo");
    expect((await cancel()).status).toBe(400);
    expectNoCancellation();
  });
  it("allows a paid-but-unsettled booking within the cutoff (refund remains with the owner)", async () => {
    vi.mocked(storage.getBooking).mockResolvedValue({ ...booking, paymentStatus: "paid" } as any);
    expect((await cancel()).status).toBe(200);
    expect(storage.cancelBookingWithReason).toHaveBeenCalledOnce();
  });
  it("can cancel a booking without a listing without reopening another listing", async () => {
    vi.mocked(storage.getBooking).mockResolvedValue({ ...booking, listingId: null } as any);
    expect((await cancel()).status).toBe(200);
    expect(storage.updateSpotListingStatus).not.toHaveBeenCalled();
  });
  it("a repeated request cannot cancel or reopen the listing twice", async () => {
    expect((await cancel()).status).toBe(200);
    vi.mocked(storage.getBooking).mockResolvedValue({ ...booking, status: "cancelled" } as any);
    expect((await cancel()).status).toBe(400);
    expect(storage.cancelBookingWithReason).toHaveBeenCalledOnce();
    expect(storage.updateSpotListingStatus).toHaveBeenCalledOnce();
  });
});
