import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Server } from 'http';

const {
  mockBookingStore,
  mockSpotStore,
  mockListingStore,
  mockDbQueue,
  mockIsTodayOrFuture,
  mockLogAction,
} = vi.hoisted(() => {
  return {
    mockBookingStore: { current: null as any },
    mockSpotStore: { current: {} as Record<string, any> },
    mockListingStore: { current: null as any },
    mockDbQueue: { values: [] as any[] },
    mockIsTodayOrFuture: { current: true },
    mockLogAction: vi.fn(async () => undefined),
  };
});

vi.mock('./db', () => {
  const createBuilder = (): any => {
    const builder: any = {
      select: vi.fn(() => builder),
      from: vi.fn(() => builder),
      where: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve(mockDbQueue.values.shift() ?? [])),
      for: vi.fn(() => Promise.resolve(mockDbQueue.values.shift() ?? [])),
      insert: vi.fn(() => builder),
      values: vi.fn(() => builder),
      returning: vi.fn(() => Promise.resolve(mockDbQueue.values.shift() ?? [])),
      update: vi.fn(() => builder),
      set: vi.fn(() => builder),
      not: vi.fn(() => builder),
    };
    builder.then = (resolve: any, reject?: any) => {
      const val = mockDbQueue.values.shift() ?? undefined;
      Promise.resolve(val).then(resolve, reject);
    };
    return builder;
  };

  const db = createBuilder();
  db.transaction = vi.fn(async (fn: any) => fn(createBuilder()));

  return { db, pool: { end: vi.fn() } };
});

vi.mock('./storage', () => ({
  storage: {
    getBooking: vi.fn(async () => mockBookingStore.current),
    getParkingSpot: vi.fn(async (id: string) => mockSpotStore.current[id] ?? null),
    getSpotListing: vi.fn(async () => mockListingStore.current),
    getUser: vi.fn(async () => null),
    getAppConfigValue: vi.fn(async () => null),
    getAllTermsVersions: vi.fn(async () => [{ version: 1 }]),
    getActiveTermsVersion: vi.fn(async () => ({ version: 1, active: true })),
    getLatestTermsVersion: vi.fn(async () => ({ version: 1 })),
    createTermsVersion: vi.fn(async () => null),
    getAllUsers: vi.fn(async () => []),
    getLatestFiredMilestone: vi.fn(async () => null),
    recordMilestone: vi.fn(async () => undefined),
    getAllAdminEmails: vi.fn(async () => []),
    updateSpotListingStatus: vi.fn(async () => undefined),
    updateBooking: vi.fn(async (id: string, updates: any) => ({ ...mockBookingStore.current, ...updates })),
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
  getRenterRankings: vi.fn(async () => ({})),
  getOwnerRankings: vi.fn(async () => ({})),
  computeMilestoneMetrics: vi.fn(async () => ({ totalBookings: 0, totalSpend: 0, p2pRevenue: 0, participants: 0 })),
}));

vi.mock('./report-service', () => ({
  sendReportEmail: vi.fn(async () => undefined),
  isEmailServiceAvailable: vi.fn(() => false),
}));

vi.mock('./timezone', () => ({
  getTodayInTimezone: vi.fn(() => '2026-04-30'),
  formatDateInTimezone: vi.fn((d: string) => d),
  isDateInPast: vi.fn(() => false),
  isDateTodayOrFuture: vi.fn(async () => mockIsTodayOrFuture.current),
}));

vi.mock('./mcp', () => ({}));

import { registerRoutes } from './routes';

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    spotId: 'spot-1',
    listingId: null,
    ownerId: null,
    renterId: 'renter-1',
    bookingDate: '2026-06-15',
    totalAmount: '25.00',
    dailyRate: '25.00',
    paymentStatus: 'pending',
    status: 'confirmed',
    cancellationReason: null,
    ...overrides,
  };
}

function makeSpot(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    spotNumber: id.toUpperCase(),
    locationId: 'loc-1',
    isBciManaged: true,
    isActive: true,
    isBookable: true,
    deletedAt: null,
    ...overrides,
  };
}

describe('Admin swap spot for BCI bookings', () => {
  let app: express.Express;
  let server: Server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  beforeEach(() => {
    mockLogAction.mockClear();
    mockDbQueue.values = [];
    mockIsTodayOrFuture.current = true;
    mockBookingStore.current = makeBooking();
    mockListingStore.current = null; // no listing -> BCI managed
    mockSpotStore.current = {
      'spot-1': makeSpot('spot-1'),
      'spot-2': makeSpot('spot-2'),
    };
  });

  describe('GET /api/admin/bookings/:id/swap-candidates', () => {
    it('returns open BCI-managed spots at the same location, excluding the current spot and booked spots', async () => {
      mockDbQueue.values = [
        [makeSpot('spot-2'), makeSpot('spot-3')], // candidate spots query
        [{ spotId: 'spot-3' }], // spot-3 already booked on this date
      ];

      const res = await request(app).get('/api/admin/bookings/booking-1/swap-candidates');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'spot-2', spotNumber: 'SPOT-2' }]);
    });

    it('returns 403 when the booking is not BCI-managed (listing not created by admin)', async () => {
      mockListingStore.current = { id: 'listing-1', createdByAdmin: false };

      const res = await request(app).get('/api/admin/bookings/booking-1/swap-candidates');

      expect(res.status).toBe(403);
    });

    it('returns 403 when the booking date is in the past', async () => {
      mockIsTodayOrFuture.current = false;

      const res = await request(app).get('/api/admin/bookings/booking-1/swap-candidates');

      expect(res.status).toBe(403);
    });

    it('returns 404 when the booking does not exist', async () => {
      mockBookingStore.current = null;

      const res = await request(app).get('/api/admin/bookings/missing/swap-candidates');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/bookings/:id/swap-spot', () => {
    it('swaps the booking, releases the old listing, and nulls listingId when no single-day listing exists on the new spot', async () => {
      // Booking has a listingId pointing at the old spot's listing
      mockBookingStore.current = makeBooking({ listingId: 'listing-old' });
      const updatedBooking = makeBooking({ spotId: 'spot-2', listingId: 'listing-old' });
      mockDbQueue.values = [
        [], // tx: no conflicting booking on new spot
        [updatedBooking], // tx: update booking returning
        [], // listing lookup: no single-day listing on new spot
      ];

      const { storage } = await import('./storage');
      const updateListingStatus = vi.mocked(storage.updateSpotListingStatus);
      const updateBooking = vi.mocked(storage.updateBooking);
      updateListingStatus.mockClear();
      updateBooking.mockClear();

      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({ newSpotId: 'spot-2' });

      expect(res.status).toBe(200);
      expect(res.body.spotId).toBe('spot-2');
      // Old listing must be reverted to available
      expect(updateListingStatus).toHaveBeenCalledWith('listing-old', 'available');
      // No new listing found — listingId must be cleared
      expect(updateBooking).toHaveBeenCalledWith('booking-1', { listingId: null });
      expect(res.body.listingId).toBeNull();

      expect(mockLogAction).toHaveBeenCalledTimes(1);
      const [action, entityType, details] = mockLogAction.mock.calls[0];
      expect(action).toBe('SWAP_SPOT');
      expect(entityType).toBe('booking');
      expect(details.entityId).toBe('booking-1');
      expect(details.before.spotId).toBe('spot-1');
      expect(details.after.spotId).toBe('spot-2');
    });

    it('claims the new spot single-day listing and re-links listingId after swap', async () => {
      mockBookingStore.current = makeBooking({ listingId: 'listing-old' });
      const updatedBooking = makeBooking({ spotId: 'spot-2', listingId: 'listing-old' });
      const newListing = { id: 'listing-new', spotId: 'spot-2', listingType: 'single', status: 'available', singleDate: '2026-06-15' };
      mockDbQueue.values = [
        [], // tx: no conflicting booking
        [updatedBooking], // tx: update returning
        [newListing], // listing lookup: single-day listing found on new spot
      ];

      const { storage } = await import('./storage');
      const updateListingStatus = vi.mocked(storage.updateSpotListingStatus);
      const updateBooking = vi.mocked(storage.updateBooking);
      updateListingStatus.mockClear();
      updateBooking.mockClear();

      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({ newSpotId: 'spot-2' });

      expect(res.status).toBe(200);
      expect(res.body.spotId).toBe('spot-2');
      // Old listing released, new listing claimed
      expect(updateListingStatus).toHaveBeenCalledWith('listing-old', 'available');
      expect(updateListingStatus).toHaveBeenCalledWith('listing-new', 'booked');
      // Booking re-linked to new listing
      expect(updateBooking).toHaveBeenCalledWith('booking-1', { listingId: 'listing-new' });
      expect(res.body.listingId).toBe('listing-new');
    });

    it('does not touch the old listing when booking had no listingId', async () => {
      // booking.listingId is null (e.g. BCI booking created without a listing)
      mockBookingStore.current = makeBooking({ listingId: null });
      const updatedBooking = makeBooking({ spotId: 'spot-2', listingId: null });
      mockDbQueue.values = [
        [], // tx: no conflicting booking
        [updatedBooking], // tx: update returning
        [], // listing lookup: no single-day listing on new spot
      ];

      const { storage } = await import('./storage');
      const updateListingStatus = vi.mocked(storage.updateSpotListingStatus);
      updateListingStatus.mockClear();

      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({ newSpotId: 'spot-2' });

      expect(res.status).toBe(200);
      // updateSpotListingStatus must not be called for the old (null) listing
      expect(updateListingStatus).not.toHaveBeenCalledWith(null, expect.anything());
    });

    it('returns 409 without swapping when the target spot was just booked by someone else', async () => {
      mockDbQueue.values = [
        [{ id: 'other-booking', spotId: 'spot-2' }], // tx: conflicting booking found
      ];

      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({ newSpotId: 'spot-2' });

      expect(res.status).toBe(409);
      expect(mockLogAction).not.toHaveBeenCalled();
    });

    it('returns 403 when the booking is not BCI-managed', async () => {
      mockListingStore.current = { id: 'listing-1', createdByAdmin: false };

      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({ newSpotId: 'spot-2' });

      expect(res.status).toBe(403);
      expect(mockLogAction).not.toHaveBeenCalled();
    });

    it('returns 403 when the booking date is in the past', async () => {
      mockIsTodayOrFuture.current = false;

      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({ newSpotId: 'spot-2' });

      expect(res.status).toBe(403);
      expect(mockLogAction).not.toHaveBeenCalled();
    });

    it('returns 400 when the new spot is not BCI-managed', async () => {
      mockSpotStore.current['spot-2'] = makeSpot('spot-2', { isBciManaged: false });

      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({ newSpotId: 'spot-2' });

      expect(res.status).toBe(400);
      expect(mockLogAction).not.toHaveBeenCalled();
    });

    it('returns 400 when the new spot is at a different location', async () => {
      mockSpotStore.current['spot-2'] = makeSpot('spot-2', { locationId: 'loc-2' });

      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({ newSpotId: 'spot-2' });

      expect(res.status).toBe(400);
      expect(mockLogAction).not.toHaveBeenCalled();
    });

    it('returns 400 when newSpotId is the same as the current spot', async () => {
      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({ newSpotId: 'spot-1' });

      expect(res.status).toBe(400);
      expect(mockLogAction).not.toHaveBeenCalled();
    });

    it('returns 400 when the booking is already cancelled', async () => {
      mockBookingStore.current = makeBooking({ status: 'cancelled' });

      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({ newSpotId: 'spot-2' });

      expect(res.status).toBe(400);
      expect(mockLogAction).not.toHaveBeenCalled();
    });

    it('returns 400 when newSpotId is missing', async () => {
      const res = await request(app)
        .post('/api/admin/bookings/booking-1/swap-spot')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
