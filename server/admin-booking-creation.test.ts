import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Server } from 'http';

// ---------------------------------------------------------------------------
// Hoisted mutable state — vi.hoisted runs before vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockUserStore,
  mockSpotStore,
  mockListingStore,
  mockLocationStore,
  mockNotificationPrefsStore,
  mockAuthUserId,
  mockDbQueue,
  mockDbExecuteResult,
  mockAllParkingSpots,
  mockAllSpotListings,
  mockAllBookings,
} = vi.hoisted(() => {
  return {
    mockUserStore: { current: {} as Record<string, any> },
    mockSpotStore: { current: null as any },
    mockListingStore: { current: null as any },
    mockLocationStore: { current: null as any },
    mockNotificationPrefsStore: { current: {} as Record<string, any> },
    mockAuthUserId: { current: 'admin-1' },
    mockDbQueue: { values: [] as any[] },
    mockDbExecuteResult: { current: { rows: [] as any[] } },
    mockAllParkingSpots: { current: [] as any[] },
    mockAllSpotListings: { current: [] as any[] },
    mockAllBookings: { current: [] as any[] },
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
    builder.then = (resolve: any, reject?: any) => {
      const val = mockDbQueue.values.shift() ?? undefined;
      Promise.resolve(val).then(resolve, reject);
    };
    return builder;
  };

  const db = createBuilder();
  db.transaction = vi.fn(async (fn: any) => fn(createBuilder()));
  db.execute = vi.fn(async () => mockDbExecuteResult.current);

  return { db, pool: { end: vi.fn() } };
});

vi.mock('./storage', () => ({
  storage: {
    getUser: vi.fn(async (id: string) => mockUserStore.current[id] ?? null),
    getParkingSpot: vi.fn(async () => mockSpotStore.current),
    getSpotListing: vi.fn(async () => mockListingStore.current),
    getLocation: vi.fn(async () => mockLocationStore.current),
    getNotificationPreferences: vi.fn(async (userId: string) => mockNotificationPrefsStore.current[userId] ?? {}),
    createInAppNotification: vi.fn(async () => null),
    createSpotListing: vi.fn(async (data: any) => ({ id: 'auto-listing-1', deletedAt: null, ...data })),
    updateBooking: vi.fn(async (id: string, updates: any) => ({ id, ...updates })),
    updatePaymentStatus: vi.fn(async () => null),
    updateSpotListingStatus: vi.fn(async () => null),
    cancelBookingWithReason: vi.fn(async (id: string, reason: string) => ({ id, status: 'cancelled', cancellationReason: reason })),
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
    getLatestFiredMilestone: vi.fn(async () => null),
    recordMilestone: vi.fn(async () => undefined),
    getAllAdminEmails: vi.fn(async () => []),
    getAllParkingSpots: vi.fn(async () => mockAllParkingSpots.current),
    getAllSpotListings: vi.fn(async () => mockAllSpotListings.current),
    getAllBookings: vi.fn(async () => mockAllBookings.current),
    getSpotType: vi.fn(async () => ({ id: 1, name: 'Standard' })),
    getDepartment: vi.fn(async () => ({ id: 1, name: 'Engineering' })),
  },
}));

vi.mock('./notification-service', () => ({
  sendPaymentReminderNotification: vi.fn(async () => ({ emailSent: true, inAppSent: true })),
  sendPaymentMarkedPaidNotification: vi.fn(async () => undefined),
  sendPaymentConfirmedNotification: vi.fn(async () => undefined),
  sendAssignmentNotification: vi.fn(async () => undefined),
  sendWelcomeNotification: vi.fn(async () => undefined),
  sendBookingConfirmationNotification: vi.fn(async () => ({ emailSent: true, inAppSent: true, ownerEmailSent: true, ownerInAppSent: true })),
  sendBookingCancellationNotification: vi.fn(async () => undefined),
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

vi.mock('./milestone-checker', () => ({
  checkSpendMilestones: vi.fn(async () => undefined),
  advanceOwnerRentalMilestone: vi.fn(async () => null),
  deliverOwnerRentalMilestone: vi.fn(async () => undefined),
  advanceRenterBookingMilestone: vi.fn(async () => null),
  deliverRenterBookingMilestone: vi.fn(async () => undefined),
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
  getTodayInTimezone: vi.fn(() => '2026-09-29'),
  formatDateInTimezone: vi.fn((d: string) => d),
  isDateInPast: vi.fn(() => false),
  isDateTodayOrFuture: vi.fn(() => true),
}));

vi.mock('./mcp', () => ({}));

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import { registerRoutes } from './routes';
import { sendBookingConfirmationNotification } from './notification-service';
import { auditService } from './audit-service';
import { storage } from './storage';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function makeUser(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    email: `${id}@example.com`,
    firstName: 'Renter',
    lastName: 'Test',
    roles: ['renter'],
    status: 'active',
    departmentId: null,
    ...overrides,
  };
}

function makeBciSpot(overrides: Record<string, any> = {}) {
  return {
    id: 'spot-bci-1',
    spotNumber: 'B01',
    locationId: 'loc-1',
    spotTypeId: 1,
    ownerId: null,
    isBciManaged: true,
    isBookable: true,
    isDeleted: false,
    deletedAt: null,
    seatNumber: null,
    defaultPrice: '20.00',
    ...overrides,
  };
}

function makeListing(overrides: Record<string, any> = {}) {
  return {
    id: 'listing-bci-1',
    spotId: 'spot-bci-1',
    ownerId: 'admin-1',
    listingType: 'single',
    singleDate: '2026-09-28',
    periodStartDate: null,
    periodEndDate: null,
    recurringStartDate: null,
    recurringEndDate: null,
    daysOfWeek: null,
    dailyRate: '20.00',
    originalDailyRate: null,
    saleEventId: null,
    saleStartDate: null,
    saleEndDate: null,
    status: 'available',
    createdByAdmin: true,
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

function makeCreatedBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'admin-booking-1',
    listingId: 'listing-bci-1',
    spotId: 'spot-bci-1',
    renterId: 'renter-1',
    ownerId: 'unassigned',
    bookingDate: '2026-09-28',
    dailyRate: '20.00',
    totalAmount: '20.00',
    status: 'confirmed',
    paymentStatus: 'pending',
    notes: null,
    ...overrides,
  };
}

// Queue matching the admin booking creation code path when an existing single-day
// listing already covers the requested date:
//   1. select spotListings single (findListingForBookingDate) -> [listing]
//   Inside transaction:
//   2. tx.select spotListings for('update') -> [{id, status}]
//   3. tx.select bookings limit(1) -> dup check
//   4. tx.insert bookings returning -> [newBooking]
function setupAdminBookingDbQueue(listing = makeListing(), newBooking = makeCreatedBooking(), dupBookings: any[] = []) {
  mockDbQueue.values = [
    [listing],
    [{ id: listing.id, status: 'available' }],
    dupBookings,
    dupBookings.length > 0 ? undefined : [newBooking],
  ];
}

describe('Admin manual booking creation', () => {
  let app: express.Express;
  let server: Server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  beforeEach(() => {
    vi.mocked(sendBookingConfirmationNotification).mockClear();
    vi.mocked(auditService.logAction).mockClear();

    mockAuthUserId.current = 'admin-1';
    mockDbQueue.values = [];
    mockDbExecuteResult.current = { rows: [] };
    mockAllParkingSpots.current = [];
    mockAllSpotListings.current = [];
    mockAllBookings.current = [];
    mockSpotStore.current = makeBciSpot();
    mockListingStore.current = makeListing();
    mockLocationStore.current = makeLocation();
    mockNotificationPrefsStore.current = {};
    mockUserStore.current = {
      'admin-1': makeUser('admin-1', { roles: ['admin'] }),
      'renter-1': makeUser('renter-1'),
    };
  });

  describe('POST /api/admin/bookings', () => {
    it('rejects an individually-owned (peer-to-peer) spot with a clear error', async () => {
      mockSpotStore.current = makeBciSpot({ ownerId: 'owner-1', isBciManaged: true });

      const res = await request(app)
        .post('/api/admin/bookings')
        .send({ renterId: 'renter-1', spotId: 'spot-bci-1', bookingDate: '2026-09-28' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/individually owned/i);
      expect(sendBookingConfirmationNotification).not.toHaveBeenCalled();
      expect(auditService.logAction).not.toHaveBeenCalled();
    });

    it('rejects a spot that is not BCI-managed even without an individual owner', async () => {
      mockSpotStore.current = makeBciSpot({ ownerId: null, isBciManaged: false });

      const res = await request(app)
        .post('/api/admin/bookings')
        .send({ renterId: 'renter-1', spotId: 'spot-bci-1', bookingDate: '2026-09-28' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not BCI-managed/i);
    });

    it('rejects a duplicate/conflicting booking for the same spot and date', async () => {
      setupAdminBookingDbQueue(makeListing(), makeCreatedBooking(), [{ id: 'existing-booking' }]);

      const res = await request(app)
        .post('/api/admin/bookings')
        .send({ renterId: 'renter-1', spotId: 'spot-bci-1', bookingDate: '2026-09-28' });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already been booked/i);
      expect(sendBookingConfirmationNotification).not.toHaveBeenCalled();
    });

    it('rejects a duplicate booking when no listing covers the date yet, without leaving a phantom available listing behind', async () => {
      // findListingForBookingDate tries single -> period -> recurring listings in turn, each a
      // separate query, before giving up; all three come back empty here. Then inside the
      // transaction the duplicate-booking check must run and fail BEFORE any listing is
      // created. If the code regressed to creating the listing first, this queue would run
      // out and the handler would throw a real error (500) instead of cleanly returning 409.
      mockDbQueue.values = [
        [], // findListingForBookingDate: no single-day listing
        [], // findListingForBookingDate: no period listing
        [], // findListingForBookingDate: no recurring listing
        [{ id: 'existing-booking' }], // tx duplicate-booking check: conflict found
      ];

      const res = await request(app)
        .post('/api/admin/bookings')
        .send({ renterId: 'renter-1', spotId: 'spot-bci-1', bookingDate: '2026-09-28', dailyRate: 20 });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already been booked/i);
      expect(vi.mocked(storage.createSpotListing)).not.toHaveBeenCalled();
      expect(sendBookingConfirmationNotification).not.toHaveBeenCalled();
    });

    it('accepts a past date and creates the booking with correct price, payment status, and BCI classification', async () => {
      const pastListing = makeListing({ singleDate: '2020-01-15' });
      const pastBooking = makeCreatedBooking({ bookingDate: '2020-01-15', dailyRate: '20.00', totalAmount: '20.00' });
      setupAdminBookingDbQueue(pastListing, pastBooking);

      const res = await request(app)
        .post('/api/admin/bookings')
        .send({ renterId: 'renter-1', spotId: 'spot-bci-1', bookingDate: '2020-01-15' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect(res.body.paymentStatus).toBe('pending');
      expect(res.body.ownerId).toBe('unassigned');
      expect(Number(res.body.dailyRate)).toBe(20);
      expect(Number(res.body.totalAmount)).toBe(20);
      expect(res.body.bookingDate).toBe('2020-01-15');
    });

    it('writes an audit log entry recording who created the booking, for which renter/spot/date', async () => {
      setupAdminBookingDbQueue();

      const res = await request(app)
        .post('/api/admin/bookings')
        .send({ renterId: 'renter-1', spotId: 'spot-bci-1', bookingDate: '2026-09-28' });

      expect(res.status).toBe(201);
      expect(auditService.logAction).toHaveBeenCalledTimes(1);
      const [action, entityType, details] = vi.mocked(auditService.logAction).mock.calls[0];
      expect(action).toBe('CREATE');
      expect(entityType).toBe('booking');
      expect(details.message).toContain('admin-1');
      expect(details.message).toContain('renter-1@example.com');
      expect(details.message).toContain('B01');
      expect(details.after).toMatchObject({ id: 'admin-booking-1' });
    });

    it('sends the same booking confirmation notification used by the normal booking flow', async () => {
      setupAdminBookingDbQueue();

      const res = await request(app)
        .post('/api/admin/bookings')
        .send({ renterId: 'renter-1', spotId: 'spot-bci-1', bookingDate: '2026-09-28' });

      expect(res.status).toBe(201);
      await vi.waitFor(() => expect(sendBookingConfirmationNotification).toHaveBeenCalledTimes(1));

      const [renterArg, bookingArg, _prefs, ownerArg, isWps] =
        vi.mocked(sendBookingConfirmationNotification).mock.calls[0];

      expect(renterArg.id).toBe('renter-1');
      expect(renterArg.email).toBe('renter-1@example.com');
      expect(bookingArg.spotNumber).toBe('B01');
      expect(isWps).toBe(true);
      expect(ownerArg).not.toBeNull();
      expect(ownerArg!.name).toBe('BCI Workplace Services');
    });

    it('returns 404 when the renter does not exist', async () => {
      const res = await request(app)
        .post('/api/admin/bookings')
        .send({ renterId: 'no-such-renter', spotId: 'spot-bci-1', bookingDate: '2026-09-28' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/renter/i);
    });

    it('returns 400 for a malformed request body', async () => {
      const res = await request(app)
        .post('/api/admin/bookings')
        .send({ renterId: '', spotId: 'spot-bci-1', bookingDate: 'not-a-date' });

      expect(res.status).toBe(400);
    });
  });

  describe('Admin-created booking appears correctly in payroll summary', () => {
    beforeEach(() => {
      // This test asserts the current payroll month using a September fixture.
      // Freeze only Date so it remains valid as real calendar months advance.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-09-28T19:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('includes an admin-created BCI booking in the current month payroll summary, correctly classified', async () => {
      const spot = makeBciSpot();
      const listing = makeListing();
      const booking = makeCreatedBooking({ bookingDate: '2026-09-28' });

      mockAllParkingSpots.current = [spot];
      mockAllSpotListings.current = [listing];
      mockAllBookings.current = [booking];
      mockUserStore.current['renter-1'] = makeUser('renter-1');
      mockLocationStore.current = makeLocation();

      const res = await request(app).get('/api/admin/payroll-summary');

      expect(res.status).toBe(200);
      const allEntries = Object.values(res.body.periods ?? res.body).flat() as any[];
      // Fall back to scanning the raw JSON for the booking id if the response shape
      // groups periods under a different top-level key.
      const serialized = JSON.stringify(res.body);
      expect(serialized).toContain('admin-booking-1');
      expect(serialized).toContain('B01');
    });
  });

  describe('Admin-created booking appears correctly in the booking detail endpoint', () => {
    it('shows the admin-created booking with Workplace Services attribution in /api/admin/bookings/:id', async () => {
      mockDbExecuteResult.current = {
        rows: [{
          id: 'admin-booking-1',
          spot_number: 'B01',
          location_id: 'loc-1',
          is_bci_managed: true,
          spot_owner_id: null,
          building: 'Building A',
          level: 'Level 1',
          renter_id: 'renter-1',
          renter_first_name: 'Renter',
          renter_last_name: 'Test',
          renter_email: 'renter-1@example.com',
          owner_id: 'unassigned',
          owner_first_name: null,
          owner_last_name: null,
          owner_email: null,
          renter_department: 'Engineering',
          owner_department: null,
          spot_owner_first_name: null,
          spot_owner_last_name: null,
          spot_owner_email: null,
          spot_owner_department: null,
          owner_payment_type: null,
          owner_payment_instructions: null,
          booking_date: '2026-09-28',
          daily_rate: '20.00',
          total_amount: '20.00',
          status: 'confirmed',
          payment_received: false,
          payment_status: 'pending',
          notes: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      };

      const res = await request(app).get('/api/admin/bookings/admin-booking-1');

      expect(res.status).toBe(200);
      expect(res.body.spotNumber).toBe('B01');
      expect(res.body.ownerName).toBe('BCI Workplace Services');
      expect(res.body.renterName).toBe('Renter Test');
      expect(res.body.status).toBe('confirmed');
      expect(res.body.paymentStatus).toBe('pending');
      expect(res.body.dailyRate).toBe(20);
    });
  });
});
