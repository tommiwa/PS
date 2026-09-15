import { describe, expect, it, vi } from 'vitest';
import {
  ownerRentalMilestones,
  ownerRentalMilestoneState,
  renterBookingMilestones,
  renterBookingMilestoneState,
} from '@shared/schema';
import {
  transferOwnerRentalMilestoneOwnership,
  transferRenterBookingMilestoneOwnership,
} from './owner-milestone-user-transfer';

describe('owner milestone OIDC user-ID transfer', () => {
  it('preserves the accumulated count and every claim while changing only owner identity', async () => {
    const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const tx = {
      update: vi.fn((table: unknown) => {
        const entry = { table, values: {} as Record<string, unknown> };
        updates.push(entry);
        const builder: any = {
          set: vi.fn((values: Record<string, unknown>) => {
            entry.values = values;
            return builder;
          }),
          where: vi.fn(async () => undefined),
        };
        return builder;
      }),
    };

    await transferOwnerRentalMilestoneOwnership(tx, 'precreated-owner', 'oidc-owner');

    expect(updates).toHaveLength(2);
    expect(updates[0].table).toBe(ownerRentalMilestoneState);
    expect(updates[0].values).toEqual({
      ownerId: 'oidc-owner',
      updatedAt: expect.any(Date),
    });
    expect(updates[0].values).not.toHaveProperty('lifetimeBookingCount');

    expect(updates[1].table).toBe(ownerRentalMilestones);
    expect(updates[1].values).toEqual({ ownerId: 'oidc-owner' });
    expect(updates[1].values).not.toHaveProperty('milestoneCount');
    expect(updates[1].values).not.toHaveProperty('deliveryStatus');
  });
});

describe('renter milestone OIDC user-ID transfer', () => {
  it('preserves the accumulated count and every claim while changing only renter identity', async () => {
    const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const tx = {
      update: vi.fn((table: unknown) => {
        const entry = { table, values: {} as Record<string, unknown> };
        updates.push(entry);
        const builder: any = {
          set: vi.fn((values: Record<string, unknown>) => {
            entry.values = values;
            return builder;
          }),
          where: vi.fn(async () => undefined),
        };
        return builder;
      }),
    };

    await transferRenterBookingMilestoneOwnership(tx, 'precreated-renter', 'oidc-renter');

    expect(updates).toHaveLength(2);
    expect(updates[0].table).toBe(renterBookingMilestoneState);
    expect(updates[0].values).toEqual({
      renterId: 'oidc-renter',
      updatedAt: expect.any(Date),
    });
    expect(updates[0].values).not.toHaveProperty('lifetimeBookingCount');

    expect(updates[1].table).toBe(renterBookingMilestones);
    expect(updates[1].values).toEqual({ renterId: 'oidc-renter' });
    expect(updates[1].values).not.toHaveProperty('milestoneCount');
    expect(updates[1].values).not.toHaveProperty('deliveryStatus');
  });
});