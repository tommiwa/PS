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
  mockPaymentStatusStore,
  mockNotificationPrefsStore,
  mockAuthUserId,
} = vi.hoisted(() => {
  return {
    mockBookingStore: { current: null as any },
    mockUserStore: { current: {} as Record<string, any> },
    mockSpotStore: { current: null as any },
    mockListingStore: { current: null as any },
    mockLocationStore: { current: null as any },
    mockPaymentStatusStore: { updated: null as any },
    mockNotificationPrefsStore: { current: {} as Record<string, any> },
    mockAuthUserId: { current: 'test-user' },
  };
});

// ---------------------------------------------------------------------------
// Module mocks — all hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('./db', () => ({
  db: {},
  pool: { end: vi.fn() },
}));

vi.mock('./storage', () => ({
  storage: {
    getBooking: vi.fn(async () => mockBookingStore.current),
    getUser: vi.fn(async (id: string) => mockUserStore.current[id] ?? null),
    getParkingSpot: vi.fn(async () => mockSpotStore.current),
    getSpotListing: vi.fn(async () => mockListingStore.current),
    getLocation: vi.fn(async () => mockLocationStore.current),
    updatePaymentStatus: vi.fn(async (_id: string, status: string) => {
      mockPaymentStatusStore.updated = status;
      return { ...mockBookingStore.current, paymentStatus: status };
    }),
    getNotificationPreferences: vi.fn(async (userId: string) => mockNotificationPrefsStore.current[userId] ?? {}),
    createInAppNotification: vi.fn(async () => null),
    updateBooking: vi.fn(async (id: string, updates: any) => ({ id, ...updates })),
    getAllTermsVersions: vi.fn(async () => [{ version: 1 }]),
    getActiveTermsVersion: vi.fn(async () => ({ version: 1, active: true })),
    getLatestTermsVersion: vi.fn(async () => ({ version: 1 })),
    createTermsVersion: vi.fn(async () => null),
    getLatestFiredMilestone: vi.fn(async () => null),
    recordMilestone: vi.fn(async () => undefined),
    getAllAdminEmails: vi.fn(async () => []),
  },
}));

vi.mock('./notification-service', () => ({
  sendPaymentReminderNotification: vi.fn(async () => ({ emailSent: true, inAppSent: true })),
  sendPaymentMarkedPaidNotification: vi.fn(async () => undefined),
  sendPaymentConfirmedNotification: vi.fn(async () => undefined),
  sendAssignmentNotification: vi.fn(async () => undefined),
  sendWelcomeNotification: vi.fn(async () => undefined),
  sendBookingConfirmationNotification: vi.fn(async () => undefined),
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
  isDateTodayOrFuture: vi.fn(() => true),
}));

vi.mock('./mcp', () => ({}));

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import { registerRoutes } from './routes';
import {
  sendPaymentReminderNotification,
  sendPaymentMarkedPaidNotification,
  sendPaymentConfirmedNotification,
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
    bookingDate: '2026-05-01',
    totalAmount: '25.00',
    dailyRate: '25.00',
    paymentStatus: 'pending',
    status: 'confirmed',
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
    ...overrides,
  };
}

function makeListing(overrides: Record<string, any> = {}) {
  return {
    id: 'listing-1',
    createdByAdmin: false,
    ...overrides,
  };
}

function makeLocation(overrides: Record<string, any> = {}) {
  return {
    id: 'loc-1',
    office: 'Main Office',
    building: 'Building A',
    level: 'Level 1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Payment notification emails', () => {
  let app: express.Express;
  let server: Server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  beforeEach(() => {
    vi.mocked(sendPaymentReminderNotification).mockClear();
    vi.mocked(sendPaymentMarkedPaidNotification).mockClear();
    vi.mocked(sendPaymentConfirmedNotification).mockClear();

    mockSpotStore.current = makeSpot();
    mockListingStore.current = makeListing();
    mockLocationStore.current = makeLocation();
    mockNotificationPrefsStore.current = {};
  });

  // -------------------------------------------------------------------------
  // Flow 1: POST /api/bookings/:id/notify-owner
  //   - Renter notifies owner that payment has been marked as paid
  //   - Must call sendPaymentMarkedPaidNotification, NOT sendPaymentReminderNotification
  // -------------------------------------------------------------------------
  describe('POST /api/bookings/:id/notify-owner', () => {
    it('calls sendPaymentMarkedPaidNotification (not sendPaymentReminderNotification) for a regular owner listing', async () => {
      mockAuthUserId.current = 'renter-1';
      mockBookingStore.current = makeBooking({ paymentStatus: 'paid' });
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
        'owner-1': makeUser('owner-1'),
      };

      const res = await request(app)
        .post('/api/bookings/booking-1/notify-owner')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      expect(sendPaymentMarkedPaidNotification).toHaveBeenCalledTimes(1);
      expect(sendPaymentReminderNotification).not.toHaveBeenCalled();

      const [ownerArg, renterArg, bookingArg] = vi.mocked(sendPaymentMarkedPaidNotification).mock.calls[0];
      expect(ownerArg.email).toBe('owner-1@example.com');
      expect(renterArg.email).toBe('renter-1@example.com');
      expect(bookingArg.spotNumber).toBe('A12');
    });

    it('calls sendPaymentMarkedPaidNotification to the WPS email for admin-created listings', async () => {
      mockAuthUserId.current = 'renter-1';
      mockBookingStore.current = makeBooking({ paymentStatus: 'paid', ownerId: null });
      mockListingStore.current = makeListing({ createdByAdmin: true });
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
      };

      const res = await request(app)
        .post('/api/bookings/booking-1/notify-owner')
        .send({});

      expect(res.status).toBe(200);

      expect(sendPaymentMarkedPaidNotification).toHaveBeenCalledTimes(1);
      expect(sendPaymentReminderNotification).not.toHaveBeenCalled();

      const [ownerArg] = vi.mocked(sendPaymentMarkedPaidNotification).mock.calls[0];
      expect(ownerArg.name).toBe('BCI Workplace Services');
    });

    it('returns 400 when payment status is still pending (not yet paid)', async () => {
      mockAuthUserId.current = 'renter-1';
      mockBookingStore.current = makeBooking({ paymentStatus: 'pending' });
      mockUserStore.current = { 'renter-1': makeUser('renter-1') };

      const res = await request(app)
        .post('/api/bookings/booking-1/notify-owner')
        .send({});

      expect(res.status).toBe(400);
      expect(sendPaymentMarkedPaidNotification).not.toHaveBeenCalled();
    });

    it('returns 403 when the requester is not the renter', async () => {
      mockAuthUserId.current = 'owner-1';
      mockBookingStore.current = makeBooking({ paymentStatus: 'paid' });
      mockUserStore.current = { 'owner-1': makeUser('owner-1') };

      const res = await request(app)
        .post('/api/bookings/booking-1/notify-owner')
        .send({});

      expect(res.status).toBe(403);
      expect(sendPaymentMarkedPaidNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Flow 2: POST /api/bookings/:id/payment-reminder
  //   - Owner sends reminder to renter to pay
  //   - dueDate must equal bookingDate + 7 days
  // -------------------------------------------------------------------------
  describe('POST /api/bookings/:id/payment-reminder', () => {
    it('calls sendPaymentReminderNotification with dueDate = bookingDate + 7 days', async () => {
      mockAuthUserId.current = 'owner-1';
      const bookingDate = '2026-05-01';
      mockBookingStore.current = makeBooking({ bookingDate, paymentStatus: 'pending', ownerId: 'owner-1' });
      mockUserStore.current = {
        'owner-1': makeUser('owner-1'),
        'renter-1': makeUser('renter-1'),
      };

      const res = await request(app)
        .post('/api/bookings/booking-1/payment-reminder')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      expect(sendPaymentReminderNotification).toHaveBeenCalledTimes(1);
      expect(sendPaymentMarkedPaidNotification).not.toHaveBeenCalled();

      const [userArg, paymentArg] = vi.mocked(sendPaymentReminderNotification).mock.calls[0];

      expect(userArg.email).toBe('renter-1@example.com');
      expect(userArg.id).toBe('renter-1');

      // dueDate = 2026-05-01 + 7 days = 2026-05-08
      const expectedDueDate = new Date(new Date(bookingDate).getTime() + 7 * 24 * 60 * 60 * 1000);
      expect(paymentArg.dueDate).toBeInstanceOf(Date);
      expect(paymentArg.dueDate.getTime()).toBe(expectedDueDate.getTime());
      expect(paymentArg.bookingId).toBe('booking-1');
    });

    it('returns 400 when payment is not in pending state', async () => {
      mockAuthUserId.current = 'owner-1';
      mockBookingStore.current = makeBooking({ paymentStatus: 'paid', ownerId: 'owner-1' });
      mockUserStore.current = {
        'owner-1': makeUser('owner-1'),
        'renter-1': makeUser('renter-1'),
      };

      const res = await request(app)
        .post('/api/bookings/booking-1/payment-reminder')
        .send({});

      expect(res.status).toBe(400);
      expect(sendPaymentReminderNotification).not.toHaveBeenCalled();
    });

    it('returns 403 when requester is not the owner or admin', async () => {
      mockAuthUserId.current = 'renter-1';
      mockBookingStore.current = makeBooking({ paymentStatus: 'pending', ownerId: 'owner-1' });
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
        'owner-1': makeUser('owner-1'),
      };

      const res = await request(app)
        .post('/api/bookings/booking-1/payment-reminder')
        .send({});

      expect(res.status).toBe(403);
      expect(sendPaymentReminderNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Flow 3: PATCH /api/bookings/:id/payment (payment-status transitions)
  //   - Renter marks pending→paid: must call sendPaymentMarkedPaidNotification
  //   - Owner marks paid→received: must call sendPaymentConfirmedNotification
  // -------------------------------------------------------------------------
  describe('PATCH /api/bookings/:id/payment — payment status transitions', () => {
    it('calls sendPaymentMarkedPaidNotification when renter transitions pending→paid', async () => {
      mockAuthUserId.current = 'renter-1';
      mockBookingStore.current = makeBooking({ paymentStatus: 'pending', ownerId: 'owner-1', renterId: 'renter-1' });
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
        'owner-1': makeUser('owner-1'),
      };

      const res = await request(app)
        .patch('/api/bookings/booking-1/payment')
        .send({ paymentStatus: 'paid' });

      expect(res.status).toBe(200);

      expect(sendPaymentMarkedPaidNotification).toHaveBeenCalledTimes(1);
      expect(sendPaymentReminderNotification).not.toHaveBeenCalled();
      expect(sendPaymentConfirmedNotification).not.toHaveBeenCalled();

      const [ownerArg, renterArg] = vi.mocked(sendPaymentMarkedPaidNotification).mock.calls[0];
      expect(ownerArg.email).toBe('owner-1@example.com');
      expect(renterArg.email).toBe('renter-1@example.com');
    });

    it('calls sendPaymentConfirmedNotification when owner transitions paid→received', async () => {
      mockAuthUserId.current = 'owner-1';
      mockBookingStore.current = makeBooking({ paymentStatus: 'paid', ownerId: 'owner-1', renterId: 'renter-1' });
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
        'owner-1': makeUser('owner-1'),
      };

      const res = await request(app)
        .patch('/api/bookings/booking-1/payment')
        .send({ paymentStatus: 'received' });

      expect(res.status).toBe(200);

      expect(sendPaymentConfirmedNotification).toHaveBeenCalledTimes(1);
      expect(sendPaymentMarkedPaidNotification).not.toHaveBeenCalled();
      expect(sendPaymentReminderNotification).not.toHaveBeenCalled();

      const [renterArg, ownerArg] = vi.mocked(sendPaymentConfirmedNotification).mock.calls[0];
      expect(renterArg.email).toBe('renter-1@example.com');
      expect(ownerArg.email).toBe('owner-1@example.com');
    });

    it('calls sendPaymentMarkedPaidNotification to the WPS email (not a real owner) for admin-created listings when transitioning to paid', async () => {
      mockAuthUserId.current = 'renter-1';
      mockListingStore.current = makeListing({ createdByAdmin: true });
      mockBookingStore.current = makeBooking({ paymentStatus: 'pending', ownerId: 'owner-1', renterId: 'renter-1' });
      mockUserStore.current = {
        'renter-1': makeUser('renter-1'),
      };

      const res = await request(app)
        .patch('/api/bookings/booking-1/payment')
        .send({ paymentStatus: 'paid' });

      expect(res.status).toBe(200);

      expect(sendPaymentMarkedPaidNotification).toHaveBeenCalledTimes(1);
      const [ownerArg] = vi.mocked(sendPaymentMarkedPaidNotification).mock.calls[0];
      expect(ownerArg.name).toBe('BCI Workplace Services');
    });

    it('returns 403 when renter attempts to set status to received', async () => {
      mockAuthUserId.current = 'renter-1';
      mockBookingStore.current = makeBooking({ paymentStatus: 'paid', ownerId: 'owner-1', renterId: 'renter-1' });
      mockUserStore.current = { 'renter-1': makeUser('renter-1') };

      const res = await request(app)
        .patch('/api/bookings/booking-1/payment')
        .send({ paymentStatus: 'received' });

      expect(res.status).toBe(403);
      expect(sendPaymentConfirmedNotification).not.toHaveBeenCalled();
    });

    it('returns 403 when owner attempts to mark pending→paid', async () => {
      mockAuthUserId.current = 'owner-1';
      mockBookingStore.current = makeBooking({ paymentStatus: 'pending', ownerId: 'owner-1', renterId: 'renter-1' });
      mockUserStore.current = { 'owner-1': makeUser('owner-1') };

      const res = await request(app)
        .patch('/api/bookings/booking-1/payment')
        .send({ paymentStatus: 'paid' });

      expect(res.status).toBe(403);
      expect(sendPaymentMarkedPaidNotification).not.toHaveBeenCalled();
    });
  });
});
