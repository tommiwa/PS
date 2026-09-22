import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Server } from 'http';

// Regression coverage for task #378: releasing/unassigning a personally-owned spot must
// reclassify it as BCI-managed pool inventory (isBciManaged: true) so it stays visible in the
// Available tab and classifies correctly for payment routing, instead of getting stuck
// unowned-but-not-pool-classified.

const {
  mockSpotStore,
  mockUserStore,
  mockUpdateParkingSpot,
  mockLogAction,
} = vi.hoisted(() => {
  return {
    mockSpotStore: { current: {} as Record<string, any> },
    mockUserStore: { current: {} as Record<string, any> },
    mockUpdateParkingSpot: vi.fn(async (id: string, updates: any) => ({
      id,
      ...updates,
    })),
    mockLogAction: vi.fn(async () => undefined),
  };
});

vi.mock('./db', () => ({
  db: {},
  pool: { end: vi.fn() },
}));

vi.mock('./storage', () => ({
  storage: {
    getParkingSpot: vi.fn(async (id: string) => mockSpotStore.current[id] ?? null),
    updateParkingSpot: mockUpdateParkingSpot,
    getUser: vi.fn(async (id: string) => mockUserStore.current[id] ?? null),
    getParkingSpotsByOwner: vi.fn(async () => []),
    removeUserRole: vi.fn(async () => undefined),
    recordSpotAssignment: vi.fn(async () => undefined),
    getLocation: vi.fn(async () => null),
    getBookingsBySpot: vi.fn(async () => []),
    getNotificationPreferences: vi.fn(async () => ({})),
  },
}));

vi.mock('./notification-service', () => ({}));

vi.mock('./replitAuth', () => ({
  setupAuth: vi.fn(async () => undefined),
  isAuthenticated: vi.fn((req: any, _res: any, next: any) => {
    req.user = { claims: { sub: 'admin-1' } };
    next();
  }),
  requireAdmin: vi.fn((req: any, _res: any, next: any) => {
    req.user = { claims: { sub: 'admin-1' } };
    next();
  }),
  getAuthenticatedUserId: vi.fn((req: any) => req.user?.claims?.sub ?? null),
  getAuthenticatedUserRole: vi.fn(() => 'admin'),
  getAuthenticatedUserBaseRole: vi.fn(() => 'admin'),
}));

vi.mock('./websocket', () => ({
  broadcastLockEvent: vi.fn(),
}));

vi.mock('./occupancy', () => ({
  getListingDates: vi.fn(() => []),
  maybeNotifyFullOccupancy: vi.fn(async () => undefined),
}));

vi.mock('./audit-service', () => ({
  auditService: {
    logAction: mockLogAction,
  },
}));

vi.mock('./audit-storage', () => ({
  dbAuditStorage: {
    createAuditLog: vi.fn(async () => null),
    getAuditLogs: vi.fn(async () => []),
    getAuditLog: vi.fn(async () => null),
  },
}));

vi.mock('./audit-middleware', () => ({
  auditContextMiddleware: vi.fn((_req: any, _res: any, next: any) => next()),
  auditResponseMiddleware: vi.fn((_req: any, _res: any, next: any) => next()),
  auditErrorMiddleware: vi.fn((_err: any, _req: any, _res: any, next: any) => next()),
}));

vi.mock('./reports-controller', () => ({
  getReportOverview: vi.fn(async () => ({})),
  getReportUtilization: vi.fn(async () => ({})),
  getReportRevenue: vi.fn(async () => ({})),
  getReportUserCompliance: vi.fn(async () => ({})),
  getReportWaitlistPerformance: vi.fn(async () => ({})),
  getSpotAssignmentReport: vi.fn(async () => ({})),
  getSharedPoolUsageReport: vi.fn(async () => ({})),
  getActiveUsersReport: vi.fn(async () => ({})),
  getSpotAlertSubscribersReport: vi.fn(async () => ({})),
  getRenterRankings: vi.fn(async () => ({})),
  getOwnerRankings: vi.fn(async () => ({})),
  computeMilestoneMetrics: vi.fn(async () => ({ totalBookings: 0, totalSpend: 0, p2pRevenue: 0, participants: 0 })),
}));

vi.mock('./report-service', () => ({
  sendReportEmail: vi.fn(async () => undefined),
  isEmailServiceAvailable: vi.fn(() => false),
}));

vi.mock('./timezone', () => ({
  getTodayInTimezone: vi.fn(() => '2026-09-21'),
  formatDateInTimezone: vi.fn((d: string) => d),
  isDateInPast: vi.fn(() => false),
  isDateTodayOrFuture: vi.fn(async () => true),
}));

vi.mock('./mcp', () => ({}));

import { registerRoutes } from './routes';
import { isWorkplaceServicesListing } from './booking-classification';

function makeSpot(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    spotNumber: id.toUpperCase(),
    locationId: 1,
    spotTypeId: 1,
    ownerId: 'owner-1',
    isBciManaged: false, // personally-owned spots are never flagged BCI-managed
    isActive: true,
    isBookable: true,
    deletedAt: null,
    ...overrides,
  };
}

function makeOwner(overrides: Record<string, any> = {}) {
  return {
    id: 'owner-1',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'owner@bci.ca',
    roles: ['owner', 'renter'],
    ...overrides,
  };
}

describe('Task #378: released/unassigned spots are reclassified as BCI-managed pool inventory', () => {
  let app: express.Express;
  let server: Server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  beforeEach(() => {
    mockUpdateParkingSpot.mockClear();
    mockLogAction.mockClear();
    mockSpotStore.current = { 'spot-1': makeSpot('spot-1') };
    mockUserStore.current = { 'owner-1': makeOwner() };
  });

  describe('PUT /api/admin/spots/:spotId/unassign', () => {
    it('sets isBciManaged: true when clearing the owner', async () => {
      const res = await request(app).put('/api/admin/spots/spot-1/unassign');

      expect(res.status).toBe(200);
      expect(mockUpdateParkingSpot).toHaveBeenCalledWith('spot-1', { ownerId: null, isBciManaged: true });
      expect(res.body.isBciManaged).toBe(true);
    });
  });

  describe('PUT /api/admin/spots/:id ("Release Spot" generic update)', () => {
    it('sets isBciManaged: true when the release clears ownerId to null', async () => {
      const res = await request(app)
        .put('/api/admin/spots/spot-1')
        .send({ ownerId: null });

      expect(res.status).toBe(200);
      expect(mockUpdateParkingSpot).toHaveBeenCalledWith('spot-1', { ownerId: null, isBciManaged: true });
      expect(res.body.isBciManaged).toBe(true);
    });

    it('does not force isBciManaged when reassigning to a different owner (still personal)', async () => {
      const res = await request(app)
        .put('/api/admin/spots/spot-1')
        .send({ ownerId: 'owner-2' });

      expect(res.status).toBe(200);
      expect(mockUpdateParkingSpot).toHaveBeenCalledWith('spot-1', { ownerId: 'owner-2' });
    });

    it('leaves isBciManaged alone for unrelated updates on an already-unowned spot', async () => {
      mockSpotStore.current = { 'spot-1': makeSpot('spot-1', { ownerId: null, isBciManaged: true }) };

      const res = await request(app)
        .put('/api/admin/spots/spot-1')
        .send({ description: 'Near the elevator' });

      expect(res.status).toBe(200);
      expect(mockUpdateParkingSpot).toHaveBeenCalledWith('spot-1', { description: 'Near the elevator' });
    });
  });

  describe('Downstream effect on direct-assignment booking classification', () => {
    it('a released spot (owner cleared, now isBciManaged: true) resolves as Workplace Services for a direct-assignment booking', () => {
      const releasedSpot = { ownerId: null, isBciManaged: true };
      expect(isWorkplaceServicesListing(null, releasedSpot)).toBe(true);
    });

    it('a spot stuck with the stale flag (owner cleared, isBciManaged still false) would misclassify as peer-to-peer', () => {
      const staleSpot = { ownerId: null, isBciManaged: false };
      expect(isWorkplaceServicesListing(null, staleSpot)).toBe(false);
    });
  });
});
