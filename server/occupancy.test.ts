import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWhere, mockSelect, mockListingsStore } = vi.hoisted(() => {
  const mockListingsStore: Array<Record<string, unknown>> = [];
  const mockWhere = vi.fn().mockImplementation(() => Promise.resolve(mockListingsStore));
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return { mockWhere, mockFrom, mockSelect, mockListingsStore };
});

vi.mock('./db', () => ({
  db: { select: mockSelect },
}));

vi.mock('./notification-service', () => ({
  sendFullOccupancyNotification: vi.fn().mockResolvedValue(undefined),
}));

import { checkOccupancyForDate, maybeNotifyFullOccupancy } from './occupancy';
import { sendFullOccupancyNotification } from './notification-service';

const WPS_EMAIL = 'wps@example.com';

function setMockListings(listings: Array<Record<string, unknown>>) {
  mockListingsStore.length = 0;
  listings.forEach(l => mockListingsStore.push(l));
}

function makeListing(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'listing-1',
    listingType: 'single',
    singleDate: '2026-06-01',
    periodStartDate: null,
    periodEndDate: null,
    recurringStartDate: null,
    recurringEndDate: null,
    daysOfWeek: null,
    status: 'available',
    deletedAt: null,
    ...overrides,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'admin@example.com',
    roles: ['admin'],
    status: 'active',
    ...overrides,
  };
}

describe('checkOccupancyForDate', () => {
  beforeEach(() => {
    setMockListings([]);
  });

  it('returns isFull=false when there are no listings for the date', async () => {
    const result = await checkOccupancyForDate('2026-06-01');
    expect(result.isFull).toBe(false);
    expect(result.totalBooked).toBe(0);
  });

  it('returns isFull=false when at least one listing is still available', async () => {
    setMockListings([
      makeListing({ id: 'l1', status: 'booked' }),
      makeListing({ id: 'l2', status: 'available' }),
    ]);
    const result = await checkOccupancyForDate('2026-06-01');
    expect(result.isFull).toBe(false);
    expect(result.totalBooked).toBe(1);
  });

  it('returns isFull=true when all listings are booked', async () => {
    setMockListings([
      makeListing({ id: 'l1', status: 'booked' }),
      makeListing({ id: 'l2', status: 'booked' }),
    ]);
    const result = await checkOccupancyForDate('2026-06-01');
    expect(result.isFull).toBe(true);
    expect(result.totalBooked).toBe(2);
  });

  it('returns isFull=false when only available listings exist (none booked)', async () => {
    setMockListings([makeListing({ id: 'l1', status: 'available' })]);
    const result = await checkOccupancyForDate('2026-06-01');
    expect(result.isFull).toBe(false);
    expect(result.totalBooked).toBe(0);
  });
});

describe('maybeNotifyFullOccupancy — full orchestration', () => {
  const TARGET_DATE = '2026-07-15';

  const adminUser = makeUser({ id: 'admin-1', email: 'admin@example.com' });
  const nonAdminUser = makeUser({ id: 'user-2', email: 'renter@example.com', roles: ['renter'] });
  const inactiveAdmin = makeUser({ id: 'admin-2', email: 'old@example.com', roles: ['admin'], status: 'inactive' });

  const getAllUsers = vi.fn().mockResolvedValue([adminUser, nonAdminUser, inactiveAdmin]);

  // claimNotification returning true simulates successfully claiming the send-right (first caller wins)
  const claimNotification = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.mocked(sendFullOccupancyNotification).mockClear();
    getAllUsers.mockClear();
    claimNotification.mockClear();
    claimNotification.mockResolvedValue(true);
    setMockListings([]);
  });

  it('does not send the email and does not claim when available listings remain', async () => {
    setMockListings([
      makeListing({ id: 'l1', singleDate: TARGET_DATE, status: 'booked' }),
      makeListing({ id: 'l2', singleDate: TARGET_DATE, status: 'available' }),
    ]);

    await maybeNotifyFullOccupancy(TARGET_DATE, getAllUsers, WPS_EMAIL, claimNotification);

    expect(sendFullOccupancyNotification).not.toHaveBeenCalled();
    expect(claimNotification).not.toHaveBeenCalled();
    expect(getAllUsers).not.toHaveBeenCalled();
  });

  it('sends the email exactly once when all listings are booked, including WPS and active admin emails', async () => {
    setMockListings([
      makeListing({ id: 'l1', singleDate: TARGET_DATE, status: 'booked' }),
      makeListing({ id: 'l2', singleDate: TARGET_DATE, status: 'booked' }),
    ]);

    await maybeNotifyFullOccupancy(TARGET_DATE, getAllUsers, WPS_EMAIL, claimNotification);

    expect(claimNotification).toHaveBeenCalledWith(TARGET_DATE);
    expect(getAllUsers).toHaveBeenCalledTimes(1);
    expect(sendFullOccupancyNotification).toHaveBeenCalledTimes(1);
    expect(sendFullOccupancyNotification).toHaveBeenCalledWith(
      TARGET_DATE,
      2,
      expect.arrayContaining([WPS_EMAIL, 'admin@example.com']),
    );

    const recipients: string[] = vi.mocked(sendFullOccupancyNotification).mock.calls[0][2];
    expect(recipients).not.toContain('renter@example.com');
    expect(recipients).not.toContain('old@example.com');
  });

  it('does NOT send the email when claimNotification returns false (dedup guard)', async () => {
    claimNotification.mockResolvedValue(false);

    setMockListings([
      makeListing({ id: 'l1', singleDate: TARGET_DATE, status: 'booked' }),
    ]);

    await maybeNotifyFullOccupancy(TARGET_DATE, getAllUsers, WPS_EMAIL, claimNotification);

    expect(claimNotification).toHaveBeenCalledWith(TARGET_DATE);
    expect(sendFullOccupancyNotification).not.toHaveBeenCalled();
    expect(getAllUsers).not.toHaveBeenCalled();
  });

  it('treats different dates independently — each fully-booked date triggers its own email', async () => {
    const DATE_A = '2026-08-01';
    const DATE_B = '2026-08-02';

    setMockListings([makeListing({ id: 'l1', singleDate: DATE_A, status: 'booked' })]);
    await maybeNotifyFullOccupancy(DATE_A, getAllUsers, WPS_EMAIL, claimNotification);

    setMockListings([makeListing({ id: 'l2', singleDate: DATE_B, status: 'booked' })]);
    await maybeNotifyFullOccupancy(DATE_B, getAllUsers, WPS_EMAIL, claimNotification);

    expect(claimNotification).toHaveBeenCalledTimes(2);
    expect(sendFullOccupancyNotification).toHaveBeenCalledTimes(2);
  });

  it('deduplicates the WPS email if an admin user has the same address', async () => {
    const wpsAsAdmin = makeUser({ id: 'wps-admin', email: WPS_EMAIL, roles: ['admin'], status: 'active' });
    const getUsersWithWPS = vi.fn().mockResolvedValue([wpsAsAdmin]);

    setMockListings([makeListing({ id: 'l1', singleDate: TARGET_DATE, status: 'booked' })]);

    await maybeNotifyFullOccupancy(TARGET_DATE, getUsersWithWPS, WPS_EMAIL, claimNotification);

    const recipients: string[] = vi.mocked(sendFullOccupancyNotification).mock.calls[0][2];
    const wpsCount = recipients.filter(r => r === WPS_EMAIL).length;
    expect(wpsCount).toBe(1);
  });
});
