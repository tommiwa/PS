import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Server } from 'http';

// ---------------------------------------------------------------------------
// Hoisted mutable state — vi.hoisted runs before vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockBookingStore,
  mockUserStore,
  mockSpotStore,
  mockListingStore,
  mockLocationStore,
  mockNotificationPrefsStore,
  mockAuthUserId,
  mockDbQueue,
} = vi.hoisted(() => {
  return {
    mockBookingStore: { current: null as any },
    mockUserStore: { current: {} as Record<string, any> },
    mockSpotStore: { current: null as any },
    mockListingStore: { current: null as any },
    mockLocationStore: { current: null as any },
    mockNotificationPrefsStore: { current: {} as Record<string, any> },
    mockAuthUserId: { current: 'test-user' },
    // Queue of values to return from successive terminal db chain calls
    mockDbQueue: { values: [] as any[] },
  };
});

// ---------------------------------------------------------------------------
// Module mocks — all hoisted before imports
// ---------------------------------------------------------------------------

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
    // Make the builder a thenable so `await builder.where(...)` resolves
    // (used for db.update().set().where() and bare db.select().from().where())
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
    getUser: vi.fn(async (id: string) => mockUserStore.current[id] ?? null),
    getParkingSpot: vi.fn(async () => mockSpotStore.current),
    getSpotListing: vi.fn(async () => mockListingStore.current),
    getLocation: vi.fn(async () => mockLocationStore.current),
    getNotificationPreferences: vi.fn(async (userId: string) => mockNotificationPrefsStore.current[userId] ?? {}),
    createInAppNotification: vi.fn(async () => null),
    updateBooking: vi.fn(async (id: string, updates: any) => ({ id, ...updates })),
    updatePaymentStatus: vi.fn(async () => null),
    updateSpotListingStatus: vi.fn(async () => null),
    cancelBookingWithReason: vi.fn(async (id: string, reason: string) => ({
      ...mockBookingStore.current,
      id,
      status: 'cancelled',
      cancellationReason: reason,
    })),
    cancelSpotListing: vi.fn(async () => null),
    deleteSpotListing: vi.fn(async () => null),
    getSpotListingsBySpot: vi.fn(async () => []),
    getBookingsBySpot: vi.fn(async () => []),
    getBookingsByListing: vi.fn(async () => []),
    getAppConfigValue: vi.fn(async () => null),
    getAllTermsVersions: vi.fn(async () => [{ version: 1 }]),
    getActiveTermsVersion: vi.fn(async () => ({ version: 1, active: true })),
    getLatestTermsVersion: vi.fn(async () => ({ version: 1 })),
    createTermsVersion: vi.fn(async () => null),
    getAllUsers: vi.fn(async () => []),
  },
}));

vi.mock('./notification-service', () => ({
  sendPaymentReminderNotification: vi.fn(async () => ({ emailSent: true, inAppSent: true })),
  sendPaymentMarkedPaidNotification: vi.fn(async () => undefined),
  sendPaymentConfirmedNotification: vi.fn(async () => undefined),
  sendAssignmentNotification: vi.fn(async () => undefined),
  sendWelcomeNotification: vi.fn(async () => undefined),
  sendBookingConfirmationNotification: vi.fn(async () => ({ emailSent: true, inAppSent: true, ownerEmailSent: true, ownerInAppSent: true })),
  sendBookingCancellationNotification: vi.fn(async () => ({ emailSent: true, inAppSent: true, ownerEmailSent: true, ownerInAppSent: true })),
  sendSpotAvailabilityNotification: vi.fn(async () => undefined),
  sendWeeklySummaryNotification: vi.fn(async () => undefined),
  sendSystemMaintenanceNotification: vi.fn(async () => undefined),
  sendEmailNotification: vi.fn(async () => ({ success: true })),
  sendSpotAlertEmail: vi.fn(async () => undefined),
  sendFullOccupancyNotification: vi.fn(async () => undefined),
  createPromotionBroadcastNotification: vi.fn(() => ({})),
  wrapEmailTemplate: vi.fn((html: string) => html),
}));

vi.mock('./replitAuth', () => ({
  setupAuth: vi.fn(async () => undefined),
  isAuthenticated: vi.fn((req: any, _res: any, next: any) => {
    req.user = { claims: { sub: mockAuthUserId.current } };
    next();
  }),
  requireAdmin: vi.fn((req: any, _res: any, next: any) => {
    req.user = { claims: { sub: mockAuthUserId.current } };
    next();
  }),
  getAuthenticatedUserId: vi.fn((req: any) => req.user?.claims?.sub ?? null),
  getAuthenticatedUserRole: vi.fn(() => 'user'),
  getAuthenticatedUserBaseRole: vi.fn(() => 'user'),
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
    logAction: vi.fn(async () => undefined),
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
}));

vi.mock('./report-service', () => ({
  sendReportEmail: vi.fn(async () => undefined),
  isEmailServiceAvailable: vi.fn(() => false),
}));

vi.mock('./timezone', () => ({
  getTodayInTimezone: vi.fn(() => '2026-04-30'),
  formatDateInTimezone: vi.fn((d: string) => d),
  isDateInPast: vi.fn(() => false),
  isDateTodayOrFuture: vi.fn(() => true),
}));

vi.mock('./mcp', () => ({}));

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import { registerRoutes } from './routes';
import {
  sendBookingConfirmationNotification,
  sendBookingCancellationNotification,
} from './notification-service';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    spotId: 'spot-1',
    listingId: 'listing-1',
    ownerId: 'owner-1',
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

function makeUser(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    email: `${id}@example.com`,
    firstName: id === 'owner-1' ? 'Alice' : 'Bob',
    lastName: 'Test',
    roles: [id === 'owner-1' ? 'owner' : 'renter'],
    status: 'active',
    ...overrides,
  };
}

function makeSpot(overrides: Record<string, any> = {}) {
  return {
    id: 'spot-1',
    spotNumber: 'A12',
    locationId: 'loc-1',
    ownerId: 'owner-1',
    isBookable: true,
    reservedForDepartmentId: null,
    seatNumber: null,
    ...overrides,
  };
}

function makeListing(overrides: Record<string, any> = {}) {
  return {
    id: 'listing-1',
    spotId: 'spot-1',
    ownerId: 'owner-1',
    listingType: 'single',
    singleDate: '2026-06-15',
    periodStartDate: null,
    periodEndDate: null,
    recurringStartDate: null,
    recurringEndDate: null,
    daysOfWeek: null,
    dailyRate: '25.00',
    originalDailyRate: null,
    saleEventId: null,
    saleStartDate: null,
    saleEndDate: null,
    status: 'available',
    createdByAdmin: false,
    donateToCharity: false,
    notes: null,
    originalListingType: null,
    deletedAt: null,
    ...overrides,
  };
}

function makeLocation(overrides: Record<string, any> = {}) {
  return {
    id: 'loc-1',
    office: 'Main Office',
    building: 'Building A',
    level: 'Level 1',
    floorPlanBaseUrl: null,
    ...overrides,
  };
}

function makeLock(overrides: Record<string, any> = {}) {
  return {
    id: 'lock-1',
    userId: 'renter-1',
    spotId: 'spot-1',
    listingId: 'listing-1',
    bookingDate: '2026-06-15',
    status: 'active',
    expiresAt: new Date(Date.now() + 2 * 60 * 1000),
    ...overrides,
  };
}

function makeCreatedBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    listingId: 'listing-1',
    spotId: 'spot-1',
    renterId: 'renter-1',
    ownerId: 'owner-1',
    bookingDate: '2026-06-15',
    dailyRate: '25.00',
    totalAmount: '25.00',
    status: 'confirmed',
    paymentStatus: 'pending',
    ...overrides,
  };
}

// Set up the db call queue for a successful single-day booking creation.
// Order matches the sequence of terminal db chain calls in routes.ts:
//   1. select spotLocks (active lock check) → []
//   2. select bookings (existing booking check) → []
//   3. select spotLocks (conflicting lock check) → []
//   4. insert spotLocks returning → [lock]
//   5. select spotListings single → [listing]
//   Inside transaction (via a fresh tx builder):
//   6. tx.select spotListings for('update') → [{id, status}]
//   7. tx.select bookings limit(1) → []
//   8. tx.insert bookings returning → [newBooking]
//   confirmLock:
//   9.  select spotLocks limit(1) → [lock]
//   10. update spotLocks set/where (thenable) → undefined
function setupBookingCreationDbQueue(listing = makeListing(), lock = makeLock(), newBooking = makeCreatedBooking()) {
  mockDbQueue.values = [
    [],          // 1. spotLocks: no active lock for user
    [],          // 2. bookings: no existing booking
    [],          // 3. spotLocks: no conflicting lock
    [lock],      // 4. insert spotLocks returning: new lock acquired
    [listing],   // 5. spotListings single: listing found
    // Inside transaction:
    [{ id: listing.id, status: 'available' }], // 6. tx.select for('update')
    [],          // 7. tx.select bookings: no dup
    [newBooking], // 8. tx.insert bookings returning: created booking
    // confirmLock:
    [lock],      // 9. select spotLocks: get lock
    undefined,   // 10. update spotLocks (thenable, void result)
  ];
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Booking email notifications', () => {
  let app: express.Express;
  let server: Server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  beforeEach(() => {
    vi.mocked(sendBookingConfirmationNotification).mockClear();
    vi.mocked(sendBookingCancellationNotification).mockClear();

    mockDbQueue.values = [];
    mockSpotStore.current = makeSpot();
    mockListingStore.current = makeListing();
    mockLocationStore.current = makeLocation();
    mockNotificationPrefsStore.current = {};
  });

  // -------------------------------------------------------------------------
  // Flow 1: POST /api/bookings
  //   - Booking created → sendBookingConfirmationNotification must be called
  //   - Must NOT call sendBookingCancellationNotification
  // -------------------------------------------------------------------------
  describe('POST /api/bookings — booking confirmation email', () => {
    it('calls sendBookingConfirmationNotification (not cancellation) when a booking is created for a regular owner listing', async () => {
      mockAuthUserId.current = 'renter-1';
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
        'owner-1': makeUser('owner-1'),
      };
      setupBookingCreationDbQueue();

      const res = await request(app)
        .post('/api/bookings')
        .send({
          spotId: 'spot-1',
          listingId: 'listing-1',
          bookingDate: '2026-06-15',
          dailyRate: '25.00',
          totalAmount: '25.00',
          status: 'confirmed',
          paymentStatus: 'pending',
        });

      expect(res.status).toBe(200);

      // Wait for the setImmediate callback to flush
      await vi.waitFor(() => expect(sendBookingConfirmationNotification).toHaveBeenCalledTimes(1));

      expect(sendBookingCancellationNotification).not.toHaveBeenCalled();

      const [renterArg, bookingArg, _prefs, ownerArg] =
        vi.mocked(sendBookingConfirmationNotification).mock.calls[0];

      expect(renterArg.email).toBe('renter-1@example.com');
      expect(renterArg.id).toBe('renter-1');
      expect(bookingArg.spotNumber).toBe('A12');
      expect(bookingArg.location).toBe('Main Office');
      expect(ownerArg).not.toBeNull();
      expect(ownerArg!.email).toBe('owner-1@example.com');
    });

    it('passes isWorkplaceServicesListing=true and routes owner to WPS for admin-created listings', async () => {
      mockAuthUserId.current = 'renter-1';
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
      };
      const adminListing = makeListing({ createdByAdmin: true, ownerId: null });
      mockListingStore.current = adminListing;
      const spot = makeSpot({ ownerId: null });
      mockSpotStore.current = spot;
      setupBookingCreationDbQueue(adminListing);

      const res = await request(app)
        .post('/api/bookings')
        .send({
          spotId: 'spot-1',
          listingId: 'listing-1',
          bookingDate: '2026-06-15',
          dailyRate: '25.00',
          totalAmount: '25.00',
          status: 'confirmed',
          paymentStatus: 'pending',
        });

      expect(res.status).toBe(200);

      await vi.waitFor(() => expect(sendBookingConfirmationNotification).toHaveBeenCalledTimes(1));

      const [renterArg, _bookingArg, _prefs, ownerArg, isWps] =
        vi.mocked(sendBookingConfirmationNotification).mock.calls[0];

      expect(renterArg.email).toBe('renter-1@example.com');
      expect(isWps).toBe(true);
      expect(ownerArg).not.toBeNull();
      expect(ownerArg!.name).toBe('BCI Workplace Services');
    });

    it('returns 403 when the spot is not bookable and does not send any email', async () => {
      mockAuthUserId.current = 'renter-1';
      mockSpotStore.current = makeSpot({ isBookable: false });
      mockUserStore.current = { 'renter-1': makeUser('renter-1') };

      const res = await request(app)
        .post('/api/bookings')
        .send({
          spotId: 'spot-1',
          listingId: 'listing-1',
          bookingDate: '2026-06-15',
          dailyRate: '25.00',
          totalAmount: '25.00',
          status: 'confirmed',
          paymentStatus: 'pending',
        });

      expect(res.status).toBe(403);
      expect(sendBookingConfirmationNotification).not.toHaveBeenCalled();
      expect(sendBookingCancellationNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Flow 2: POST /api/bookings/:id/cancel (renter cancellation)
  //   - Must call sendBookingCancellationNotification with cancelledByRole='renter'
  //   - Must NOT call sendBookingConfirmationNotification
  // -------------------------------------------------------------------------
  describe('POST /api/bookings/:id/cancel — renter cancellation email', () => {
    it('calls sendBookingCancellationNotification (not confirmation) when renter cancels a booking', async () => {
      mockAuthUserId.current = 'renter-1';
      // Booking date far in future to pass the 24-hour cancellation window check
      mockBookingStore.current = makeBooking({ bookingDate: '2027-06-15' });
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
        'owner-1': makeUser('owner-1'),
      };

      const res = await request(app)
        .post('/api/bookings/booking-1/cancel')
        .send({});

      expect(res.status).toBe(200);

      await vi.waitFor(() => expect(sendBookingCancellationNotification).toHaveBeenCalledTimes(1));

      expect(sendBookingConfirmationNotification).not.toHaveBeenCalled();

      const [renterArg, bookingArg, _prefs, ownerArg] =
        vi.mocked(sendBookingCancellationNotification).mock.calls[0];

      expect(renterArg.email).toBe('renter-1@example.com');
      expect(renterArg.id).toBe('renter-1');
      expect(bookingArg.id).toBe('booking-1');
      expect(bookingArg.spotNumber).toBe('A12');
      expect(bookingArg.cancelledByRole).toBe('renter');
      expect(ownerArg).not.toBeNull();
      expect(ownerArg!.email).toBe('owner-1@example.com');
    });

    it('routes owner notification to WPS when the listing was created by admin', async () => {
      mockAuthUserId.current = 'renter-1';
      mockBookingStore.current = makeBooking({ bookingDate: '2027-06-15' });
      mockListingStore.current = makeListing({ createdByAdmin: true, ownerId: null });
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
      };

      const res = await request(app)
        .post('/api/bookings/booking-1/cancel')
        .send({});

      expect(res.status).toBe(200);

      await vi.waitFor(() => expect(sendBookingCancellationNotification).toHaveBeenCalledTimes(1));

      const [, , , ownerArg] = vi.mocked(sendBookingCancellationNotification).mock.calls[0];
      expect(ownerArg).not.toBeNull();
      expect(ownerArg!.name).toBe('BCI Workplace Services');
    });

    it('returns 400 when the booking is within the cancellation window and does not send any email', async () => {
      mockAuthUserId.current = 'renter-1';
      // Booking date in the past / within 24 hours
      mockBookingStore.current = makeBooking({ bookingDate: '2026-04-30' });
      mockUserStore.current = { 'renter-1': makeUser('renter-1') };

      const res = await request(app)
        .post('/api/bookings/booking-1/cancel')
        .send({});

      expect(res.status).toBe(400);
      expect(sendBookingCancellationNotification).not.toHaveBeenCalled();
    });

    it('returns 403 when the requester is not the renter and does not send any email', async () => {
      mockAuthUserId.current = 'owner-1';
      mockBookingStore.current = makeBooking({ bookingDate: '2027-06-15' });
      mockUserStore.current = { 'owner-1': makeUser('owner-1') };

      const res = await request(app)
        .post('/api/bookings/booking-1/cancel')
        .send({});

      expect(res.status).toBe(403);
      expect(sendBookingCancellationNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Flow 3: POST /api/bookings/:id/owner-cancel (owner cancellation)
  //   - Must call sendBookingCancellationNotification with cancelledByRole='owner'
  //   - Must NOT call sendBookingConfirmationNotification
  // -------------------------------------------------------------------------
  describe('POST /api/bookings/:id/owner-cancel — owner cancellation email', () => {
    it('calls sendBookingCancellationNotification (not confirmation) when owner cancels a booking', async () => {
      mockAuthUserId.current = 'owner-1';
      // Booking date in future so the "past booking" guard doesn't trigger
      mockBookingStore.current = makeBooking({ bookingDate: '2027-06-15' });
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
        'owner-1': makeUser('owner-1'),
      };

      const res = await request(app)
        .post('/api/bookings/booking-1/owner-cancel')
        .send({});

      expect(res.status).toBe(200);

      await vi.waitFor(() => expect(sendBookingCancellationNotification).toHaveBeenCalledTimes(1));

      expect(sendBookingConfirmationNotification).not.toHaveBeenCalled();

      const [renterArg, bookingArg, _prefs, ownerArg] =
        vi.mocked(sendBookingCancellationNotification).mock.calls[0];

      expect(renterArg.email).toBe('renter-1@example.com');
      expect(renterArg.id).toBe('renter-1');
      expect(bookingArg.id).toBe('booking-1');
      expect(bookingArg.spotNumber).toBe('A12');
      expect(bookingArg.cancelledByRole).toBe('owner');
      expect(ownerArg).not.toBeNull();
      expect(ownerArg!.email).toBe('owner-1@example.com');
    });

    it('returns 403 when the requester is not the spot owner and does not send any email', async () => {
      mockAuthUserId.current = 'renter-1';
      mockBookingStore.current = makeBooking({ bookingDate: '2027-06-15' });
      mockUserStore.current = { 'renter-1': makeUser('renter-1') };

      const res = await request(app)
        .post('/api/bookings/booking-1/owner-cancel')
        .send({});

      expect(res.status).toBe(403);
      expect(sendBookingCancellationNotification).not.toHaveBeenCalled();
    });

    it('returns 400 when cancelling a past booking and does not send any email', async () => {
      mockAuthUserId.current = 'owner-1';
      mockBookingStore.current = makeBooking({ bookingDate: '2026-04-01' });
      mockUserStore.current = {
        'owner-1': makeUser('owner-1'),
      };

      const res = await request(app)
        .post('/api/bookings/booking-1/owner-cancel')
        .send({});

      expect(res.status).toBe(400);
      expect(sendBookingCancellationNotification).not.toHaveBeenCalled();
    });
  });
});
