import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Booking, RenterBookingMilestone } from '@shared/schema';

const mocks = vi.hoisted(() => ({
  renter: vi.fn(),
  claimDelivery: vi.fn(),
  pendingClaims: vi.fn(),
  updateDelivery: vi.fn(),
  send: vi.fn(),
}));

vi.mock('./storage', () => ({
  storage: {
    getUser: mocks.renter,
    claimRenterBookingMilestoneDelivery: mocks.claimDelivery,
    getPendingRenterBookingMilestones: mocks.pendingClaims,
    updateRenterBookingMilestoneDelivery: mocks.updateDelivery,
    getAppConfigValue: vi.fn(),
    getLatestFiredMilestone: vi.fn(),
    getAllAdminEmails: vi.fn(),
    recordMilestone: vi.fn(),
  },
}));

vi.mock('./notification-service', () => ({
  sendRenterBookingMilestoneEmail: mocks.send,
  sendSpendMilestoneEmail: vi.fn(),
}));

vi.mock('./reports-controller', () => ({
  computeMilestoneMetrics: vi.fn(),
}));

import {
  advanceRenterBookingMilestone,
  deliverRenterBookingMilestone,
  deliverPendingRenterBookingMilestones,
} from './milestone-checker';

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-100',
    listingId: 'listing-1',
    spotId: 'spot-1',
    renterId: 'renter-1',
    ownerId: 'owner-1',
    bookingDate: '2026-09-10',
    dailyRate: '20.00',
    totalAmount: '20.00',
    status: 'confirmed',
    paymentReceived: false,
    paymentStatus: 'pending',
    notes: null,
    adminNotes: null,
    cancellationReason: null,
    paymentRefundedAt: null,
    refundAmount: null,
    excludedFromPayroll: false,
    lastOwnerReminderSentAt: null,
    createdAt: new Date('2026-09-10T12:00:00Z'),
    updatedAt: new Date('2026-09-10T12:00:00Z'),
    ...overrides,
  };
}

function claim(count = 100): RenterBookingMilestone {
  return {
    id: `claim-${count}`,
    renterId: 'renter-1',
    milestoneCount: count,
    triggeringBookingId: `booking-${count}`,
    lifetimeBookingCount: count,
    deliveryStatus: 'pending',
    deliveryProvider: null,
    deliveryError: null,
    deliveryAttemptCount: 0,
    sendingStartedAt: null,
    claimedAt: new Date(),
    deliveredAt: null,
  };
}

function transactionAtCount(count: number, claimed: RenterBookingMilestone | null = claim(count)) {
  let insertNumber = 0;
  const tx: any = {
    insert: vi.fn(() => {
      insertNumber++;
      const builder: any = {
        values: vi.fn(() => builder),
        onConflictDoUpdate: vi.fn(() => builder),
        onConflictDoNothing: vi.fn(() => builder),
        returning: vi.fn(async () => insertNumber === 1
          ? [{ renterId: 'renter-1', lifetimeBookingCount: count }]
          : claimed ? [claimed] : []),
      };
      return builder;
    }),
  };
  return tx;
}

describe('renter booking milestone checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.renter.mockResolvedValue({
      id: 'renter-1',
      email: 'renter@example.com',
      firstName: 'Riley',
      lastName: 'Renter',
    });
    mocks.send.mockResolvedValue({ success: true, provider: 'mandrill' });
    mocks.claimDelivery.mockResolvedValue(true);
    mocks.pendingClaims.mockResolvedValue([]);
    mocks.updateDelivery.mockResolvedValue(undefined);
  });

  it.each([100, 200])('atomically creates a durable claim when the booking reaches %i', async (count) => {
    const tx = transactionAtCount(count);
    const result = await advanceRenterBookingMilestone(tx, booking({ id: `booking-${count}` }));
    expect(result).toEqual(expect.objectContaining({
      id: `claim-${count}`,
      milestoneCount: count,
      lifetimeBookingCount: count,
    }));
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });

  it.each([99, 101, 199])('advances state without claiming non-milestone count %i', async (count) => {
    const tx = transactionAtCount(count);
    await expect(advanceRenterBookingMilestone(tx, booking())).resolves.toBeNull();
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it('does not advance state for bookings dated before the counting start date', async () => {
    const tx = transactionAtCount(100);
    await expect(advanceRenterBookingMilestone(
      tx,
      booking({ bookingDate: '2026-03-15' })
    )).resolves.toBeNull();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('advances state for a booking dated exactly on the counting start date', async () => {
    const tx = transactionAtCount(1);
    await expect(advanceRenterBookingMilestone(
      tx,
      booking({ bookingDate: '2026-03-16' })
    )).resolves.toBeNull();
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it('returns no duplicate claim when the unique renter-threshold insert loses a race', async () => {
    const tx = transactionAtCount(100, null);
    await expect(advanceRenterBookingMilestone(tx, booking())).resolves.toBeNull();
  });

  it('does not depend on completion, payment, owner assignment, or later cancellation status', async () => {
    const tx = transactionAtCount(100);
    await expect(advanceRenterBookingMilestone(
      tx,
      booking({ status: 'cancelled', paymentStatus: 'pending', ownerId: 'unassigned' })
    )).resolves.toEqual(expect.objectContaining({
      id: 'claim-100',
      milestoneCount: 100,
      lifetimeBookingCount: 100,
    }));
  });

  it('delivers a committed claim and records provider metadata', async () => {
    await deliverRenterBookingMilestone(claim(200));
    expect(mocks.send).toHaveBeenCalledWith(
      { name: 'Riley Renter', email: 'renter@example.com' },
      200,
      { deliveryKey: 'renter-booking-milestone-claim-200' },
    );
    expect(mocks.updateDelivery).toHaveBeenCalledWith('claim-200', {
      status: 'sent',
      provider: 'mandrill',
    });
  });

  it('allows only one worker to attempt a claimed delivery', async () => {
    mocks.claimDelivery.mockResolvedValue(false);
    await deliverRenterBookingMilestone(claim());
    expect(mocks.renter).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('records delivery failure without throwing', async () => {
    mocks.send.mockResolvedValue({ success: false, provider: 'ms365', error: 'provider unavailable' });
    await expect(deliverRenterBookingMilestone(claim())).resolves.toBeUndefined();
    expect(mocks.updateDelivery).toHaveBeenCalledWith('claim-100', {
      status: 'failed',
      provider: 'ms365',
      error: 'provider unavailable',
    });
  });

  it('leaves an ambiguous transport outcome in sending state', async () => {
    mocks.send.mockResolvedValue({
      success: false,
      provider: 'ms365',
      error: 'timeout after request dispatch',
      ambiguous: true,
    });
    await deliverRenterBookingMilestone(claim());
    expect(mocks.updateDelivery).not.toHaveBeenCalled();
  });

  it('does not overwrite sending when recording provider acceptance fails', async () => {
    mocks.updateDelivery.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(deliverRenterBookingMilestone(claim())).resolves.toBeUndefined();
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.updateDelivery).toHaveBeenCalledTimes(1);
    expect(mocks.updateDelivery).toHaveBeenCalledWith('claim-100', {
      status: 'sent',
      provider: 'mandrill',
    });
  });

  it('records a missing renter email as a delivery failure', async () => {
    mocks.renter.mockResolvedValue({ id: 'renter-1', email: null });
    await deliverRenterBookingMilestone(claim());
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.updateDelivery).toHaveBeenCalledWith('claim-100', {
      status: 'failed',
      error: 'Renter has no email address',
    });
  });

  it('recovers committed pending claims after a process restart', async () => {
    mocks.pendingClaims.mockResolvedValue([claim(100), claim(200)]);
    await deliverPendingRenterBookingMilestones();
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.updateDelivery).toHaveBeenCalledTimes(2);
  });
});
