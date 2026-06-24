import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mutable state — vi.hoisted runs before vi.mock factories
// ---------------------------------------------------------------------------
const { mockCreateInAppNotification } = vi.hoisted(() => ({
  mockCreateInAppNotification: vi.fn(async () => null),
}));

// ---------------------------------------------------------------------------
// Module mocks — only storage is needed; notification-service is NOT mocked
// so the real function runs.
// ---------------------------------------------------------------------------

vi.mock('./storage', () => ({
  storage: {
    createInAppNotification: mockCreateInAppNotification,
  },
}));

// notification-service imports @azure/msal-node which reads env vars at
// module load time but only creates the MSAL client when MS365 env vars are
// present.  In test environments none are set, so activeProvider = 'mock'.
// The mock provider adds a 100ms setTimeout; we skip the real delay by
// replacing it with fake timers only where needed — but vitest handles the
// await just fine within the default 5 s timeout.

// ---------------------------------------------------------------------------
// Import the REAL function (notification-service is NOT mocked here)
// ---------------------------------------------------------------------------
import { sendListingsRemovedDueToReassignmentNotification } from './notification-service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ownerWithEmail = { name: 'Alice Smith', email: 'alice@bci.ca', id: 'owner-1' };
const ownerNoEmail  = { name: 'Bob Doe',   email: null,            id: 'owner-2' };
const spotDetails   = { spotNumber: 'B05', location: 'Downtown - L2', building: 'Tower A' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('sendListingsRemovedDueToReassignmentNotification — unit', () => {
  beforeEach(() => {
    mockCreateInAppNotification.mockClear();
  });

  // ── Early-exit guard ────────────────────────────────────────────────────

  it('returns {emailSent:false, inAppSent:false} without calling storage when removedCount is 0', async () => {
    const result = await sendListingsRemovedDueToReassignmentNotification(
      ownerWithEmail, spotDetails, 0, '2099-01-01', {}
    );

    expect(result.emailSent).toBe(false);
    expect(result.inAppSent).toBe(false);
    expect(mockCreateInAppNotification).not.toHaveBeenCalled();
  });

  it('returns {emailSent:false, inAppSent:false} without calling storage when removedCount is negative', async () => {
    const result = await sendListingsRemovedDueToReassignmentNotification(
      ownerWithEmail, spotDetails, -3, '2099-01-01', {}
    );

    expect(result.emailSent).toBe(false);
    expect(result.inAppSent).toBe(false);
    expect(mockCreateInAppNotification).not.toHaveBeenCalled();
  });

  // ── Email gating ────────────────────────────────────────────────────────

  it('sends email (mock provider → emailSent true) and in-app notification when prefs allow and owner has email', async () => {
    const result = await sendListingsRemovedDueToReassignmentNotification(
      ownerWithEmail, spotDetails, 3, '2099-02-01', {}
    );

    expect(result.emailSent).toBe(true);
    expect(result.inAppSent).toBe(true);
    expect(mockCreateInAppNotification).toHaveBeenCalledTimes(1);
  });

  it('skips email but still creates in-app notification when emailNotifications=false', async () => {
    const result = await sendListingsRemovedDueToReassignmentNotification(
      ownerWithEmail, spotDetails, 2, '2099-02-01', { emailNotifications: false }
    );

    expect(result.emailSent).toBe(false);
    expect(result.inAppSent).toBe(true);
    expect(mockCreateInAppNotification).toHaveBeenCalledTimes(1);
  });

  it('skips email but still creates in-app notification when spotAssignment=false', async () => {
    const result = await sendListingsRemovedDueToReassignmentNotification(
      ownerWithEmail, spotDetails, 2, '2099-02-01', { spotAssignment: false }
    );

    expect(result.emailSent).toBe(false);
    expect(result.inAppSent).toBe(true);
    expect(mockCreateInAppNotification).toHaveBeenCalledTimes(1);
  });

  it('skips email but still creates in-app notification when owner has no email', async () => {
    const result = await sendListingsRemovedDueToReassignmentNotification(
      ownerNoEmail, spotDetails, 1, '2099-02-01', {}
    );

    expect(result.emailSent).toBe(false);
    expect(result.inAppSent).toBe(true);
    expect(mockCreateInAppNotification).toHaveBeenCalledTimes(1);
  });

  // ── In-app notification payload ─────────────────────────────────────────

  it('creates in-app notification with correct metadata fields', async () => {
    await sendListingsRemovedDueToReassignmentNotification(
      ownerWithEmail, spotDetails, 4, '2099-03-15', {}
    );

    expect(mockCreateInAppNotification).toHaveBeenCalledTimes(1);
    const [payload] = mockCreateInAppNotification.mock.calls[0];

    expect(payload.userId).toBe('owner-1');
    expect(payload.read).toBe(false);
    expect(payload.data).toMatchObject({
      spotNumber: 'B05',
      location: 'Downtown - L2',
      building: 'Tower A',
      removedCount: 4,
      fromDate: '2099-03-15',
      reason: 'spot_reassignment',
    });
  });
});
