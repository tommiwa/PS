import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { Server } from "http";

const mocks = vi.hoisted(() => ({
  userId: "renter",
  baseRole: "renter",
  authenticated: true,
  booking: undefined as any,
  notifications: new Map<string, { id: string; userId: string; read: boolean }>(),
}));

vi.mock("./db", () => ({ db: {}, pool: {} }));
vi.mock("./storage", () => ({
  storage: {
    getBooking: vi.fn(async () => mocks.booking),
    getAppConfigValue: vi.fn(async () => null),
    getActiveTermsVersion: vi.fn(async () => ({ version: 1 })),
    deleteInternalConfigsBefore: vi.fn(async () => 0),
    markNotificationAsRead: vi.fn(async (id: string, userId: string) => {
      const notification = mocks.notifications.get(id);
      if (notification?.userId !== userId) return undefined;
      notification.read = true;
      return notification;
    }),
    deleteInAppNotification: vi.fn(async (id: string, userId: string) => {
      if (mocks.notifications.get(id)?.userId !== userId) return false;
      return mocks.notifications.delete(id);
    }),
  },
}));
vi.mock("./replitAuth", () => ({
  setupAuth: vi.fn(),
  isAuthenticated: (req: any, res: any, next: any) => {
    if (!mocks.authenticated) return res.status(401).json({ error: "Unauthorized" });
    req.user = { claims: { sub: mocks.userId } };
    next();
  },
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  getAuthenticatedUserId: (req: any) => req.user?.claims?.sub || null,
  getAuthenticatedUserBaseRole: vi.fn(async () => mocks.baseRole),
  getAuthenticatedUserRole: vi.fn(async () => "renter"),
}));
vi.mock("./audit-service", () => ({ auditService: { logAction: vi.fn() } }));
vi.mock("./audit-storage", () => ({ dbAuditStorage: {} }));
vi.mock("./audit-middleware", () => ({
  auditContextMiddleware: (_req: any, _res: any, next: any) => next(),
  auditResponseMiddleware: (_req: any, _res: any, next: any) => next(),
  auditErrorMiddleware: (_err: any, _req: any, _res: any, next: any) => next(),
}));
vi.mock("./notification-service");
vi.mock("./reports-controller");
vi.mock("./report-service");
vi.mock("./milestone-checker");
vi.mock("./websocket");
vi.mock("./mcp", () => ({}));

import { registerRoutes } from "./routes";
import { storage } from "./storage";

describe("object authorization endpoints", () => {
  const app = express();
  let server: Server;

  beforeAll(async () => {
    vi.useFakeTimers();
    server = await registerRoutes(app);
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  afterAll(() => server?.close());
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userId = "renter";
    mocks.baseRole = "renter";
    mocks.authenticated = true;
    mocks.booking = { id: "booking", renterId: "renter", ownerId: "owner", adminNotes: "private" };
    mocks.notifications = new Map([
      ["mine", { id: "mine", userId: "renter", read: false }],
      ["theirs", { id: "theirs", userId: "other", read: false }],
    ]);
  });

  it.each(["renter", "owner", "admin"])("allows the booking %s to read it", async (userId) => {
    mocks.userId = userId;
    mocks.baseRole = userId;
    const response = await request(app).get("/api/bookings/booking");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mocks.booking);
  });

  it.each(["renter", "owner"])("denies an unrelated user with role %s", async (role) => {
    mocks.userId = "unrelated";
    mocks.baseRole = role;
    const response = await request(app).get("/api/bookings/booking");
    expect(response.status).toBe(403);
    expect(response.body).not.toHaveProperty("adminNotes");
  });

  it("does not grant admin access when the stored role is unavailable", async () => {
    mocks.userId = "unrelated";
    mocks.baseRole = null as any;
    expect((await request(app).get("/api/bookings/booking")).status).toBe(403);
  });

  it("returns 404 for a missing booking", async () => {
    mocks.booking = undefined;
    expect((await request(app).get("/api/bookings/missing")).status).toBe(404);
  });

  for (const action of ["read", "delete"] as const) {
    const send = (id: string) => action === "read"
      ? request(app).patch(`/api/notifications/${id}/read`)
      : request(app).delete(`/api/notifications/${id}`);

    it(`allows users to ${action} their own notification`, async () => {
      expect((await send("mine")).status).toBe(200);
      expect(action === "read" ? mocks.notifications.get("mine")?.read : !mocks.notifications.has("mine")).toBe(true);
      expect(action === "read" ? storage.markNotificationAsRead : storage.deleteInAppNotification)
        .toHaveBeenCalledWith("mine", "renter");
    });

    it.each(["renter", "admin"])(`blocks %s from ${action} on another user's notification`, async (role) => {
      mocks.baseRole = role;
      expect((await send("theirs")).status).toBe(404);
      expect(mocks.notifications.get("theirs")).toEqual({ id: "theirs", userId: "other", read: false });
    });

    it(`returns 404 for ${action} on a missing notification`, async () => {
      expect((await send("missing")).status).toBe(404);
    });

    it(`rejects unauthenticated ${action} requests before storage`, async () => {
      mocks.authenticated = false;
      expect((await send("mine")).status).toBe(401);
      expect(storage.markNotificationAsRead).not.toHaveBeenCalled();
      expect(storage.deleteInAppNotification).not.toHaveBeenCalled();
    });
  }

  it("rejects unauthenticated booking reads before storage", async () => {
    mocks.authenticated = false;
    expect((await request(app).get("/api/bookings/booking")).status).toBe(401);
    expect(storage.getBooking).not.toHaveBeenCalled();
  });

  it("rejects an authenticated request without a user ID", async () => {
    mocks.userId = "";
    expect((await request(app).get("/api/bookings/booking")).status).toBe(401);
    expect((await request(app).patch("/api/notifications/mine/read")).status).toBe(401);
    expect((await request(app).delete("/api/notifications/mine")).status).toBe(401);
    expect(storage.getBooking).not.toHaveBeenCalled();
    expect(storage.markNotificationAsRead).not.toHaveBeenCalled();
    expect(storage.deleteInAppNotification).not.toHaveBeenCalled();
  });
});
