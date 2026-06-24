import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Server } from 'http';

// ---------------------------------------------------------------------------
// Hoisted mutable state — vi.hoisted runs before vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockSpotStore,
  mockUserStore,
  mockLocationStore,
  mockNotificationPrefsStore,
  mockAuthUserId,
  mockDeletedListings,
} = vi.hoisted(() => ({
  mockSpotStore: { current: null as any },
  mockUserStore: { current: {} as Record<string, any> },
  mockLocationStore: { current: null as any },
  mockNotificationPrefsStore: { current: {} as Record<string, any> },
  mockAuthUserId: { current: 'admin-user' },
  mockDeletedListings: { count: 0 },
}));

// ---------------------------------------------------------------------------
// Module mocks — all hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('./db', () => ({
  db: {},
  pool: { end: vi.fn() },
}));

vi.mock('./storage', () => ({
  storage: {
    getParkingSpot: vi.fn(async () => mockSpotStore.current),
    getUser: vi.fn(async (id: string) => mockUserStore.current[id] ?? null),
    getLocation: vi.fn(async () => mockLocationStore.current),
    getNotificationPreferences: vi.fn(async (userId: string) => mockNotificationPrefsStore.current[userId] ?? {}),
    createInAppNotification: vi.fn(async () => null),
    getSpotType: vi.fn(async () => null),
    getDepartment: vi.fn(async () => null),
    cancelSpotPendingScheduledAssignments: vi.fn(async () => 0),
    createScheduledAssignment: vi.fn(async () => ({
      id: 'sched-1',
      spotId: 'spot-1',
      userId: 'new-owner',
      scheduledDate: '2099-01-01',
      status: 'pending',
    })),
    getBookingsBySpot: vi.fn(async () => []),
    softDeleteListingsBySpotIdFromDate: vi.fn(async () => mockDeletedListings.count),
    getAllTermsVersions: vi.fn(async () => [{ version: 1 }]),
    getActiveTermsVersion: vi.fn(async () => ({ version: 1, active: true })),
    getLatestTermsVersion: vi.fn(async () => ({ version: 1 })),
    createTermsVersion: vi.fn(async () => null),
    getLatestFiredMilestone: vi.fn(async () => null),
    recordMilestone: vi.fn(async () => undefined),
    getAllAdminEmails: vi.fn(async () => []),
    getAppConfigValue: vi.fn(async () => null),
  },
}));

vi.mock('./notification-service', () => ({
  sendListingsRemovedDueToReassignmentNotification: vi.fn(async () => ({ emailSent: true, inAppSent: true })),
  sendBookingsCancelledDueToUnassignmentNotification: vi.fn(async () => undefined),
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
import { sendListingsRemovedDueToReassignmentNotification } from './notification-service';
import { storage } from './storage';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function makeSpot(overrides: Record<string, any> = {}) {
  return {
    id: 'spot-1',
    spotNumber: 'B05',
    locationId: 'loc-1',
    ownerId: 'outgoing-owner',
    isBciManaged: false,
    deletedAt: null,
    spotTypeId: null,
    reservedForDepartmentId: null,
    ...overrides,
  };
}

function makeUser(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    email: `${id}@example.com`,
    firstName: id === 'outgoing-owner' ? 'Alice' : 'Bob',
    lastName: 'Smith',
    status: 'active',
    ...overrides,
  };
}

function makeLocation(overrides: Record<string, any> = {}) {
  return {
    id: 'loc-1',
    office: 'Downtown Office',
    building: 'Tower A',
    level: 'Level 2',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Integration tests — POST /api/admin/assign-spot (scheduled path)
// ---------------------------------------------------------------------------
describe('POST /api/admin/assign-spot — scheduled path triggers listing-removal notification', () => {
  let app: express.Express;
  let server: Server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  beforeEach(() => {
    vi.mocked(sendListingsRemovedDueToReassignmentNotification).mockClear();

    mockSpotStore.current = makeSpot();
    mockUserStore.current = {
      'admin-user': makeUser('admin-user'),
      'new-owner': makeUser('new-owner'),
      'outgoing-owner': makeUser('outgoing-owner'),
    };
    mockLocationStore.current = makeLocation();
    mockNotificationPrefsStore.current = {};
    mockDeletedListings.count = 0;

    vi.mocked(storage.cancelSpotPendingScheduledAssignments).mockResolvedValue(0);
    vi.mocked(storage.createScheduledAssignment).mockResolvedValue({
      id: 'sched-1',
      spotId: 'spot-1',
      userId: 'new-owner',
      scheduledDate: '2099-01-01',
      status: 'pending',
    } as any);
  });

  it('calls sendListingsRemovedDueToReassignmentNotification when listings are deleted', async () => {
    mockDeletedListings.count = 5;

    const res = await request(app)
      .post('/api/admin/assign-spot')
      .send({ spotId: 'spot-1', userId: 'new-owner', scheduledDate: '2099-01-01' });

    expect(res.status).toBe(200);
    expect(res.body.scheduled).toBe(true);

    expect(sendListingsRemovedDueToReassignmentNotification).toHaveBeenCalledTimes(1);

    const [ownerArg, spotArg, countArg, dateArg] =
      vi.mocked(sendListingsRemovedDueToReassignmentNotification).mock.calls[0];
    expect(ownerArg.id).toBe('outgoing-owner');
    expect(ownerArg.email).toBe('outgoing-owner@example.com');
    expect(spotArg.spotNumber).toBe('B05');
    expect(countArg).toBe(5);
    expect(dateArg).toBe('2099-01-01');
  });

  it('does NOT call sendListingsRemovedDueToReassignmentNotification when no listings are deleted', async () => {
    mockDeletedListings.count = 0;

    const res = await request(app)
      .post('/api/admin/assign-spot')
      .send({ spotId: 'spot-1', userId: 'new-owner', scheduledDate: '2099-01-01' });

    expect(res.status).toBe(200);
    expect(res.body.scheduled).toBe(true);

    expect(sendListingsRemovedDueToReassignmentNotification).not.toHaveBeenCalled();
  });

  it('does NOT call sendListingsRemovedDueToReassignmentNotification when spot has no current owner', async () => {
    mockDeletedListings.count = 3;
    mockSpotStore.current = makeSpot({ ownerId: null });

    const res = await request(app)
      .post('/api/admin/assign-spot')
      .send({ spotId: 'spot-1', userId: 'new-owner', scheduledDate: '2099-01-01' });

    expect(res.status).toBe(200);
    expect(res.body.scheduled).toBe(true);

    expect(sendListingsRemovedDueToReassignmentNotification).not.toHaveBeenCalled();
  });

  it('passes outgoing owner notification preferences to the notification function', async () => {
    mockDeletedListings.count = 2;
    mockNotificationPrefsStore.current['outgoing-owner'] = { emailNotifications: false, spotAssignment: true };

    const res = await request(app)
      .post('/api/admin/assign-spot')
      .send({ spotId: 'spot-1', userId: 'new-owner', scheduledDate: '2099-01-01' });

    expect(res.status).toBe(200);

    expect(sendListingsRemovedDueToReassignmentNotification).toHaveBeenCalledTimes(1);

    const [, , , , prefsArg] =
      vi.mocked(sendListingsRemovedDueToReassignmentNotification).mock.calls[0];
    expect(prefsArg).toMatchObject({ emailNotifications: false, spotAssignment: true });
  });

  it('returns 404 when the spot does not exist', async () => {
    mockSpotStore.current = null;

    const res = await request(app)
      .post('/api/admin/assign-spot')
      .send({ spotId: 'spot-1', userId: 'new-owner', scheduledDate: '2099-01-01' });

    expect(res.status).toBe(404);
    expect(sendListingsRemovedDueToReassignmentNotification).not.toHaveBeenCalled();
  });

  it('returns 404 when the target user does not exist', async () => {
    mockUserStore.current = { 'admin-user': makeUser('admin-user') };

    const res = await request(app)
      .post('/api/admin/assign-spot')
      .send({ spotId: 'spot-1', userId: 'new-owner', scheduledDate: '2099-01-01' });

    expect(res.status).toBe(404);
    expect(sendListingsRemovedDueToReassignmentNotification).not.toHaveBeenCalled();
  });
});
