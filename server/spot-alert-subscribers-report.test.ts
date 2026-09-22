import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { SpotAlertSubscriptionWithUser } from '@shared/schema';

vi.mock('./storage', () => ({
  storage: {
    getAllSpotAlertSubscriptionsWithUsers: vi.fn(),
  },
}));

import { storage } from './storage';
import { getSpotAlertSubscribersReport } from './reports-controller';

function makeSubscriber(overrides: Partial<SpotAlertSubscriptionWithUser> = {}): SpotAlertSubscriptionWithUser {
  return {
    id: 'sub-1',
    userId: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    isActive: true,
    daysOfWeek: [1, 3, 5],
    maxDailyPrice: '15.00',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

function makeRes() {
  const res: Partial<Response> = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

describe('GET /api/admin/reports/spot-alert-subscribers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns every subscriber row from storage untouched, with a total/active summary', async () => {
    const subscribers = [
      makeSubscriber({ id: 'sub-1', isActive: true }),
      makeSubscriber({ id: 'sub-2', userId: 'user-2', isActive: false, daysOfWeek: [], maxDailyPrice: null }),
    ];
    vi.mocked(storage.getAllSpotAlertSubscriptionsWithUsers).mockResolvedValue(subscribers);

    const res = makeRes();
    await getSpotAlertSubscribersReport({} as Request, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      subscribers,
      summary: { total: 2, active: 1 },
    }));
  });

  it('reports zero counts when there are no subscribers, without erroring', async () => {
    vi.mocked(storage.getAllSpotAlertSubscriptionsWithUsers).mockResolvedValue([]);

    const res = makeRes();
    await getSpotAlertSubscribersReport({} as Request, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      subscribers: [],
      summary: { total: 0, active: 0 },
    }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 500 without leaking internals when storage throws', async () => {
    vi.mocked(storage.getAllSpotAlertSubscriptionsWithUsers).mockRejectedValue(new Error('db exploded'));

    const res = makeRes();
    await getSpotAlertSubscribersReport({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });
});
