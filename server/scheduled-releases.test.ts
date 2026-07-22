import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockStorage,
  mockAuditStorage,
  mockSendEmail,
  mockWrapTemplate,
} = vi.hoisted(() => {
  return {
    mockStorage: {
      getPendingScheduledReleasesDue: vi.fn(async () => []),
      getParkingSpot: vi.fn(async () => null),
      getUser: vi.fn(async () => null),
      updateParkingSpot: vi.fn(async () => null),
      getParkingSpotsByOwner: vi.fn(async () => []),
      removeUserRole: vi.fn(async () => undefined),
      recordSpotAssignment: vi.fn(async () => undefined),
      getLocation: vi.fn(async () => null),
      updateScheduledRelease: vi.fn(async () => undefined),
    },
    mockAuditStorage: {
      createAuditLog: vi.fn(async () => ({})),
    },
    mockSendEmail: vi.fn(async () => ({ success: true })),
    mockWrapTemplate: vi.fn((args: any) => `<html>${args.content}</html>`),
  };
});

vi.mock('./db', () => ({
  db: {},
  pool: { end: vi.fn() },
}));

vi.mock('./storage', () => ({
  storage: mockStorage,
}));

vi.mock('./audit-storage', () => ({
  dbAuditStorage: mockAuditStorage,
}));

vi.mock('./notification-service', () => ({
  sendEmailNotification: (...args: any[]) => mockSendEmail(...args),
  wrapEmailTemplate: (...args: any[]) => mockWrapTemplate(...args),
}));

import { applyScheduledSpotReleases } from './scheduled-releases';

function makeRelease(overrides: Record<string, any> = {}) {
  return {
    id: 'release-1',
    spotId: 'spot-1',
    scheduledDate: '2026-07-22',
    status: 'pending',
    createdBy: 'admin-1',
    createdAt: new Date('2026-07-01'),
    appliedAt: null,
    cancelledAt: null,
    notes: null,
    ...overrides,
  };
}

function makeSpot(overrides: Record<string, any> = {}) {
  return {
    id: 'spot-1',
    spotNumber: 'A-101',
    ownerId: 'owner-1',
    isBookable: true,
    locationId: 'loc-1',
    isBciManaged: false,
    ...overrides,
  };
}

function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'owner-1',
    email: 'owner@bci.ca',
    firstName: 'Jane',
    lastName: 'Smith',
    roles: ['owner', 'renter'],
    ...overrides,
  };
}

function makeAdmin(overrides: Record<string, any> = {}) {
  return {
    id: 'admin-1',
    email: 'admin@bci.ca',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['admin'],
    ...overrides,
  };
}

function makeLocation(overrides: Record<string, any> = {}) {
  return {
    id: 'loc-1',
    office: 'Vancouver',
    level: 'P1',
    building: 'Main Tower',
    ...overrides,
  };
}

const updatedSpot = { id: 'spot-1', spotNumber: 'A-101', ownerId: null, isBookable: false, locationId: 'loc-1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([]);
  mockStorage.getParkingSpot.mockResolvedValue(null);
  mockStorage.getUser.mockResolvedValue(null);
  mockStorage.updateParkingSpot.mockResolvedValue(updatedSpot);
  mockStorage.getParkingSpotsByOwner.mockResolvedValue([]);
  mockStorage.removeUserRole.mockResolvedValue(undefined);
  mockStorage.recordSpotAssignment.mockResolvedValue(undefined);
  mockStorage.getLocation.mockResolvedValue(makeLocation());
  mockStorage.updateScheduledRelease.mockResolvedValue(undefined);
  mockAuditStorage.createAuditLog.mockResolvedValue({});
  mockSendEmail.mockResolvedValue({ success: true });
  mockWrapTemplate.mockReturnValue('<html>email</html>');
});

describe('applyScheduledSpotReleases', () => {
  describe('when no releases are due', () => {
    it('returns 0 without touching storage', async () => {
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([]);
      const result = await applyScheduledSpotReleases();
      expect(result).toBe(0);
      expect(mockStorage.updateParkingSpot).not.toHaveBeenCalled();
    });
  });

  describe('spot update', () => {
    it('sets ownerId=null and isBookable=false on the spot', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);

      await applyScheduledSpotReleases();

      expect(mockStorage.updateParkingSpot).toHaveBeenCalledWith('spot-1', {
        ownerId: null,
        isBookable: false,
      });
    });

    it('skips the release when the spot is not found', async () => {
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(null);

      const result = await applyScheduledSpotReleases();

      expect(result).toBe(0);
      expect(mockStorage.updateParkingSpot).not.toHaveBeenCalled();
    });

    it('skips the release when updateParkingSpot returns null', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);
      mockStorage.updateParkingSpot.mockResolvedValue(null);

      const result = await applyScheduledSpotReleases();

      expect(result).toBe(0);
      expect(mockStorage.recordSpotAssignment).not.toHaveBeenCalled();
    });
  });

  describe('owner role removal', () => {
    it('removes owner role when former owner has no remaining spots', async () => {
      const spot = makeSpot();
      const owner = makeUser({ roles: ['owner', 'renter'] });
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);
      mockStorage.getParkingSpotsByOwner.mockResolvedValue([]);

      await applyScheduledSpotReleases();

      expect(mockStorage.removeUserRole).toHaveBeenCalledWith('owner-1', 'owner');
    });

    it('does NOT remove owner role when former owner still has other spots', async () => {
      const spot = makeSpot();
      const owner = makeUser({ roles: ['owner', 'renter'] });
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);
      mockStorage.getParkingSpotsByOwner.mockResolvedValue([
        makeSpot({ id: 'spot-2', spotNumber: 'A-102' }),
      ]);

      await applyScheduledSpotReleases();

      expect(mockStorage.removeUserRole).not.toHaveBeenCalled();
    });

    it('does NOT remove owner role when the user does not have the owner role', async () => {
      const spot = makeSpot();
      const owner = makeUser({ roles: ['renter'] });
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);
      mockStorage.getParkingSpotsByOwner.mockResolvedValue([]);

      await applyScheduledSpotReleases();

      expect(mockStorage.removeUserRole).not.toHaveBeenCalled();
    });

    it('does NOT attempt role removal when spot had no previous owner', async () => {
      const spot = makeSpot({ ownerId: null });
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);

      await applyScheduledSpotReleases();

      expect(mockStorage.removeUserRole).not.toHaveBeenCalled();
      expect(mockStorage.getParkingSpotsByOwner).not.toHaveBeenCalled();
    });
  });

  describe('assignment history recording', () => {
    it('records a "released" action in spot_assignment_history', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);

      await applyScheduledSpotReleases();

      expect(mockStorage.recordSpotAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          spotId: 'spot-1',
          userId: 'owner-1',
          action: 'released',
          actorId: 'admin-1',
          notes: expect.stringContaining('2026-07-22'),
        })
      );
    });

    it('does not record assignment history when there was no previous owner', async () => {
      const spot = makeSpot({ ownerId: null });
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);

      await applyScheduledSpotReleases();

      expect(mockStorage.recordSpotAssignment).not.toHaveBeenCalled();
    });

    it('passes actorId as undefined when release has no createdBy', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([
        makeRelease({ createdBy: null }),
      ]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);

      await applyScheduledSpotReleases();

      expect(mockStorage.recordSpotAssignment).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: undefined })
      );
    });
  });

  describe('release status update', () => {
    it('marks the release as applied with appliedAt timestamp', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);

      await applyScheduledSpotReleases();

      expect(mockStorage.updateScheduledRelease).toHaveBeenCalledWith(
        'release-1',
        expect.objectContaining({
          status: 'applied',
          appliedAt: expect.any(Date),
        })
      );
    });
  });

  describe('email notifications', () => {
    it('sends an email to the former owner', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);

      await applyScheduledSpotReleases();

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@bci.ca',
          subject: expect.stringContaining('A-101'),
          type: 'assignment',
        })
      );
    });

    it('sends an admin summary email to the scheduling admin', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      const admin = makeAdmin();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockImplementation(async (id: string) => {
        if (id === 'owner-1') return owner;
        if (id === 'admin-1') return admin;
        return null;
      });

      await applyScheduledSpotReleases();

      const calls = mockSendEmail.mock.calls;
      const adminCall = calls.find((c: any[]) => c[0].to === 'admin@bci.ca');
      expect(adminCall).toBeDefined();
      expect(adminCall![0].subject).toContain('[Admin Summary]');
    });

    it('does not send owner email when former owner has no email address', async () => {
      const spot = makeSpot();
      const owner = makeUser({ email: null });
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);

      await applyScheduledSpotReleases();

      const ownerEmailCall = mockSendEmail.mock.calls.find((c: any[]) => c[0].to === null);
      expect(ownerEmailCall).toBeUndefined();
    });

    it('does not send admin email when release has no createdBy', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([
        makeRelease({ createdBy: null }),
      ]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);

      await applyScheduledSpotReleases();

      const ownerCall = mockSendEmail.mock.calls.find((c: any[]) => c[0].to === 'owner@bci.ca');
      expect(ownerCall).toBeDefined();
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('audit logging', () => {
    it('creates an audit log entry with RELEASE action', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([makeRelease()]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);

      await applyScheduledSpotReleases();

      expect(mockAuditStorage.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RELEASE',
          entityType: 'parking_spot',
          entityId: 'spot-1',
          actorId: 'SYSTEM',
          success: true,
          correlationId: 'scheduled-release-release-1',
        })
      );
    });
  });

  describe('effective date selection', () => {
    it('only applies releases whose scheduledDate is on or before today', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      const pastRelease = makeRelease({ id: 'past', scheduledDate: '2026-07-21' });
      const todayRelease = makeRelease({ id: 'today', scheduledDate: '2026-07-22' });
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([pastRelease, todayRelease]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);

      const result = await applyScheduledSpotReleases();

      expect(result).toBe(2);
      expect(mockStorage.updateScheduledRelease).toHaveBeenCalledWith('past', expect.objectContaining({ status: 'applied' }));
      expect(mockStorage.updateScheduledRelease).toHaveBeenCalledWith('today', expect.objectContaining({ status: 'applied' }));
    });

    it('does not apply releases that getPendingScheduledReleasesDue does not return (future dates excluded by storage)', async () => {
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([]);

      const result = await applyScheduledSpotReleases();

      expect(result).toBe(0);
      expect(mockStorage.updateParkingSpot).not.toHaveBeenCalled();
    });
  });

  describe('return value', () => {
    it('returns the count of successfully applied releases', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([
        makeRelease({ id: 'release-1' }),
        makeRelease({ id: 'release-2', spotId: 'spot-2' }),
      ]);
      mockStorage.getParkingSpot.mockResolvedValue(spot);
      mockStorage.getUser.mockResolvedValue(owner);

      const result = await applyScheduledSpotReleases();

      expect(result).toBe(2);
    });

    it('returns 0 when storage.getPendingScheduledReleasesDue throws', async () => {
      mockStorage.getPendingScheduledReleasesDue.mockRejectedValue(new Error('DB down'));

      const result = await applyScheduledSpotReleases();

      expect(result).toBe(0);
    });

    it('continues processing remaining releases when one release errors', async () => {
      const spot = makeSpot();
      const owner = makeUser();
      mockStorage.getPendingScheduledReleasesDue.mockResolvedValue([
        makeRelease({ id: 'release-bad', spotId: 'spot-bad' }),
        makeRelease({ id: 'release-good', spotId: 'spot-good' }),
      ]);
      mockStorage.getParkingSpot.mockImplementation(async (id: string) => {
        if (id === 'spot-bad') throw new Error('spot fetch error');
        return { ...spot, id };
      });
      mockStorage.getUser.mockResolvedValue(owner);

      const result = await applyScheduledSpotReleases();

      expect(result).toBe(1);
    });
  });
});
