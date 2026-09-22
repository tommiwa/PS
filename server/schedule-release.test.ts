import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Server } from 'http';

const {
  mockSpotStore,
  mockPendingReleases,
  mockListings,
  mockBookings,
  mockCreateScheduledRelease,
  mockSoftDeleteListings,
  mockUpdateBooking,
  mockGetBookingsBySpot,
  mockGetScheduledReleasesForSpot,
  mockNotifyListingsRemoved,
  mockNotifyBookingsCancelled,
  mockNotifySpotUnassignment,
  mockLogAction,
} = vi.hoisted(() => {
  return {
    mockSpotStore: { current: {} as Record<string, any> },
    mockPendingReleases: { current: [] as any[] },
    mockListings: { deleted: 0 as number | Error },
    mockBookings: { current: [] as any[] },
    mockCreateScheduledRelease: vi.fn(),
    mockSoftDeleteListings: vi.fn(),
    mockUpdateBooking: vi.fn(),
    mockGetBookingsBySpot: vi.fn(),
    mockGetScheduledReleasesForSpot: vi.fn(),
    mockNotifyListingsRemoved: vi.fn(async () => undefined),
    mockNotifyBookingsCancelled: vi.fn(async () => undefined),
    mockNotifySpotUnassignment: vi.fn(async () => undefined),
    mockLogAction: vi.fn(async () => undefined),
  };
});

vi.mock('./db', () => {
  const createBuilder = (): any => {
    const builder: any = {
      select: vi.fn(() => builder),
      from: vi.fn(() => builder),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve([])),
      insert: vi.fn(() => builder),
      values: vi.fn(() => builder),
      returning: vi.fn(() => Promise.resolve([])),
      update: vi.fn(() => builder),
      set: vi.fn(() => builder),
    };
    builder.then = (resolve: any, reject?: any) => Promise.resolve([]).then(resolve, reject);
    return builder;
  };
  const db = createBuilder();
  db.transaction = vi.fn(async (fn: any) => fn(createBuilder()));
  return { db, pool: { end: vi.fn(), on: vi.fn() } };
});

vi.mock('./storage', () => ({
  storage: {
    getParkingSpot: vi.fn(async (id: string) => mockSpotStore.current[id] ?? null),
    getScheduledReleasesForSpot: mockGetScheduledReleasesForSpot,
    createScheduledRelease: mockCreateScheduledRelease,
    softDeleteListingsBySpotIdFromDate: mockSoftDeleteListings,
    getBookingsBySpot: mockGetBookingsBySpot,
    updateBooking: mockUpdateBooking,
    getUser: vi.fn(async (id: string) => ({
      id,
      email: `${id}@bci.ca`,
      firstName: 'Test',
      lastName: 'User',
      roles: ['renter'],
    })),
    getLocation: vi.fn(async () => ({ id: 1, office: 'Victoria', level: 'Level 1', building: '750 Pandora' })),
    getNotificationPreferences: vi.fn(async () => ({})),
    // Needed while registerRoutes boots
    getAppConfigValue: vi.fn(async () => null),
    getAllTermsVersions: vi.fn(async () => [{ version: 1 }]),
    getActiveTermsVersion: vi.fn(async () => ({ version: 1, active: true })),
    getLatestTermsVersion: vi.fn(async () => ({ version: 1 })),
    createTermsVersion: vi.fn(async () => null),
    getAllUsers: vi.fn(async () => []),
    getAllAdminEmails: vi.fn(async () => []),
    getLatestFiredMilestone: vi.fn(async () => null),
    recordMilestone: vi.fn(async () => undefined),
  },
}));

vi.mock('./notification-service', () => ({
  sendListingsRemovedDueToReassignmentNotification: (...args: any[]) => mockNotifyListingsRemoved(...args),
  sendBookingsCancelledDueToUnassignmentNotification: (...args: any[]) => mockNotifyBookingsCancelled(...args),
  sendSpotUnassignmentNotification: (...args: any[]) => mockNotifySpotUnassignment(...args),
}));

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
  getAuthenticatedUserRole: vi.fn(async () => 'admin'),
  getAuthenticatedUserBaseRole: vi.fn(async () => 'admin'),
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
  getTodayInTimezone: vi.fn(() => '2026-08-27'),
  formatDateInTimezone: vi.fn((d: string) => d),
  isDateInPast: vi.fn(() => false),
  isDateTodayOrFuture: vi.fn(async () => true),
}));

vi.mock('./mcp', () => ({}));

import { registerRoutes } from './routes';

const FUTURE_DATE = '2036-09-26';
const OTHER_FUTURE_DATE = '2036-10-15';
const PAST_DATE = '2020-01-01';

function makeSpot(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    spotNumber: id.toUpperCase(),
    locationId: 1,
    ownerId: 'owner-1',
    isActive: true,
    isBookable: true,
    deletedAt: null,
    ...overrides,
  };
}

function makeRelease(overrides: Record<string, any> = {}) {
  return {
    id: 'release-1',
    spotId: 'spot-1',
    scheduledDate: FUTURE_DATE,
    status: 'pending',
    createdBy: 'admin-1',
    notes: null,
    createdAt: new Date('2026-08-27'),
    appliedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    spotId: 'spot-1',
    listingId: 'listing-1',
    ownerId: 'owner-1',
    renterId: 'renter-1',
    bookingDate: FUTURE_DATE,
    dailyRate: '15.00',
    totalAmount: '15.00',
    status: 'confirmed',
    ...overrides,
  };
}

/** A message is "generic" if it gives the admin nothing to act on or quote. */
const GENERIC_MESSAGES = [
  'Internal Server Error',
  'Internal server error',
  'Failed to schedule spot release',
];

function expectSpecificError(body: any) {
  const message = body.error || body.message || '';
  expect(typeof message).toBe('string');
  expect(message.length).toBeGreaterThan(20);
  for (const generic of GENERIC_MESSAGES) {
    expect(message).not.toBe(generic);
  }
}

describe('POST /api/admin/schedule-release', () => {
  let app: express.Express;
  let server: Server;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    mockSpotStore.current = { 'spot-1': makeSpot('spot-1') };
    mockPendingReleases.current = [];
    mockBookings.current = [];

    mockGetScheduledReleasesForSpot.mockImplementation(async () => mockPendingReleases.current);
    mockCreateScheduledRelease.mockImplementation(async (data: any) => makeRelease(data));
    mockSoftDeleteListings.mockImplementation(async () => 0);
    mockGetBookingsBySpot.mockImplementation(async () => mockBookings.current);
    mockUpdateBooking.mockImplementation(async (id: string, updates: any) => ({ id, ...updates }));
  });

  const post = (body: Record<string, unknown>) =>
    request(app).post('/api/admin/schedule-release').send(body);

  it('schedules a release when nothing upcoming is affected', async () => {
    const res = await post({ spotId: 'spot-1', scheduledDate: FUTURE_DATE, notes: 'departing' });

    expect(res.status).toBe(200);
    expect(res.body.scheduled).toBe(true);
    expect(res.body.alreadyScheduled).toBe(false);
    expect(res.body.removedListings).toBe(0);
    expect(res.body.cancelledBookings).toBe(0);
    expect(res.body.notificationWarnings).toEqual([]);
    expect(mockCreateScheduledRelease).toHaveBeenCalledTimes(1);
    expect(mockLogAction).toHaveBeenCalledWith('SCHEDULE_RELEASE', 'parking_spot', expect.anything());
  });

  it('removes future unbooked listings and cancels future active bookings', async () => {
    mockSoftDeleteListings.mockImplementation(async () => 3);
    mockBookings.current = [
      makeBooking({ id: 'booking-future-1', bookingDate: FUTURE_DATE }),
      makeBooking({ id: 'booking-future-2', bookingDate: OTHER_FUTURE_DATE, renterId: 'renter-2' }),
      makeBooking({ id: 'booking-past', bookingDate: '2026-01-05' }),
      makeBooking({ id: 'booking-cancelled', bookingDate: OTHER_FUTURE_DATE, status: 'cancelled' }),
    ];

    const res = await post({ spotId: 'spot-1', scheduledDate: FUTURE_DATE });

    expect(res.status).toBe(200);
    expect(res.body.removedListings).toBe(3);
    expect(res.body.cancelledBookings).toBe(2);
    expect(mockUpdateBooking).toHaveBeenCalledTimes(2);
    expect(mockUpdateBooking).toHaveBeenCalledWith('booking-future-1', expect.objectContaining({ status: 'cancelled' }));
    expect(mockUpdateBooking).toHaveBeenCalledWith('booking-future-2', expect.objectContaining({ status: 'cancelled' }));
    // Owner + both renters notified
    expect(mockNotifyListingsRemoved).toHaveBeenCalledTimes(1);
    expect(mockNotifyBookingsCancelled).toHaveBeenCalledTimes(2);
    expect(mockNotifySpotUnassignment).toHaveBeenCalledTimes(1);
    expect(res.body.notificationWarnings).toEqual([]);
  });

  it('treats a re-submission of the same spot and date as a retry instead of a duplicate error', async () => {
    const existing = makeRelease({ id: 'release-existing', scheduledDate: FUTURE_DATE });
    mockPendingReleases.current = [existing];
    mockSoftDeleteListings.mockImplementation(async () => 1);

    const res = await post({ spotId: 'spot-1', scheduledDate: FUTURE_DATE });

    expect(res.status).toBe(200);
    expect(res.body.scheduled).toBe(true);
    expect(res.body.alreadyScheduled).toBe(true);
    expect(res.body.scheduledRelease.id).toBe('release-existing');
    // No second release row is created, but the cleanup is finished
    expect(mockCreateScheduledRelease).not.toHaveBeenCalled();
    expect(mockSoftDeleteListings).toHaveBeenCalledTimes(1);
  });

  it('rejects a pending release for a different date with a specific, actionable message', async () => {
    mockPendingReleases.current = [makeRelease({ id: 'release-other', scheduledDate: OTHER_FUTURE_DATE })];

    const res = await post({ spotId: 'spot-1', scheduledDate: FUTURE_DATE });

    expect(res.status).toBe(400);
    expectSpecificError(res.body);
    expect(res.body.error).toContain(OTHER_FUTURE_DATE);
    expect(res.body.existingReleaseId).toBe('release-other');
    expect(mockCreateScheduledRelease).not.toHaveBeenCalled();
  });

  it('rejects a past release date with a specific message', async () => {
    const res = await post({ spotId: 'spot-1', scheduledDate: PAST_DATE });

    expect(res.status).toBe(400);
    expectSpecificError(res.body);
    expect(res.body.error).toContain(PAST_DATE);
    expect(mockCreateScheduledRelease).not.toHaveBeenCalled();
  });

  it('returns a specific 404 for an unknown spot', async () => {
    const res = await post({ spotId: 'spot-missing', scheduledDate: FUTURE_DATE });

    expect(res.status).toBe(404);
    expectSpecificError(res.body);
    expect(res.body.error).toContain('spot-missing');
    expect(mockCreateScheduledRelease).not.toHaveBeenCalled();
  });

  it('rejects an unassigned spot with a specific message', async () => {
    mockSpotStore.current = { 'spot-1': makeSpot('spot-1', { ownerId: null }) };

    const res = await post({ spotId: 'spot-1', scheduledDate: FUTURE_DATE });

    expect(res.status).toBe(400);
    expectSpecificError(res.body);
    expect(res.body.error).toContain('SPOT-1');
  });

  it('still succeeds when a notification email fails, reporting it as a warning', async () => {
    mockSoftDeleteListings.mockImplementation(async () => 2);
    mockNotifyListingsRemoved.mockImplementation(async () => {
      throw new Error('Mailgun 500');
    });

    const res = await post({ spotId: 'spot-1', scheduledDate: FUTURE_DATE });

    expect(res.status).toBe(200);
    expect(res.body.scheduled).toBe(true);
    expect(res.body.notificationWarnings).toHaveLength(1);
    expect(res.body.notificationWarnings[0]).toMatch(/reference: [0-9A-F]{6}/);
    expect(res.body.notificationWarnings[0]).toContain('notify the spot owner');
  });

  it('reports the real reason and a reference when the release record cannot be saved', async () => {
    mockCreateScheduledRelease.mockImplementation(async () => {
      throw new Error('insert into "scheduled_spot_releases" failed');
    });

    const res = await post({ spotId: 'spot-1', scheduledDate: FUTURE_DATE });

    expect(res.status).toBe(500);
    expectSpecificError(res.body);
    expect(res.body.error).toContain('Could not save the scheduled release');
    expect(res.body.reference).toMatch(/^[0-9A-F]{6}$/);
    expect(res.body.error).toContain(res.body.reference);
    // The stack is logged server-side for the same reference
    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain(res.body.reference);
    expect(logged).toContain('/api/admin/schedule-release');
  });

  it('reports a partially applied cleanup so the admin knows a retry will finish it', async () => {
    mockSoftDeleteListings.mockImplementation(async () => {
      throw new Error('listing soft-delete failed');
    });

    const res = await post({ spotId: 'spot-1', scheduledDate: FUTURE_DATE });

    expect(res.status).toBe(500);
    expectSpecificError(res.body);
    expect(res.body.partial).toBe(true);
    expect(res.body.error).toContain('Re-submit the same spot and date');
    expect(res.body.reference).toMatch(/^[0-9A-F]{6}$/);
  });

  it('reports which booking failed to cancel and keeps the release for a retry', async () => {
    mockBookings.current = [
      makeBooking({ id: 'booking-ok', bookingDate: FUTURE_DATE }),
      makeBooking({ id: 'booking-bad', bookingDate: OTHER_FUTURE_DATE }),
    ];
    mockUpdateBooking.mockImplementation(async (id: string) => {
      if (id === 'booking-bad') throw new Error('deadlock detected');
      return { id, status: 'cancelled' };
    });

    const res = await post({ spotId: 'spot-1', scheduledDate: FUTURE_DATE });

    expect(res.status).toBe(500);
    expectSpecificError(res.body);
    expect(res.body.error).toContain(OTHER_FUTURE_DATE);
    expect(res.body.cancelledBookings).toBe(1);
    expect(res.body.partial).toBe(true);
  });

  it('rejects malformed input with the actual validation problem', async () => {
    const res = await post({ spotId: 'spot-1', scheduledDate: '26-09-2036' });

    expect(res.status).toBe(400);
    expectSpecificError(res.body);
    expect(res.body.error).toContain('YYYY-MM-DD');
  });
});
