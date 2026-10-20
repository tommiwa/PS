import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';

vi.mock('./db', () => ({ db: {}, pool: { on: vi.fn() } }));
vi.mock('./storage', () => ({
  storage: {
    getAppConfig: vi.fn(),
    getAppConfigValue: vi.fn(),
    updateAppConfig: vi.fn(),
    deleteInternalConfigsBefore: vi.fn(async () => 0),
    getAllTermsVersions: vi.fn(async () => [{ version: 1 }]),
    getActiveTermsVersion: vi.fn(async () => ({ version: 1 })),
  },
}));
vi.mock('./replitAuth', () => ({
  setupAuth: vi.fn(async () => undefined),
  isAuthenticated: vi.fn((_req, _res, next) => next()),
  requireAdmin: vi.fn((req, res, next) => {
    if (req.headers['x-test-role'] !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = { id: 'admin-1' };
    next();
  }),
  getAuthenticatedUserId: vi.fn(),
  getAuthenticatedUserRole: vi.fn(),
  getAuthenticatedUserBaseRole: vi.fn(),
}));
vi.mock('./websocket', () => ({ broadcastLockEvent: vi.fn() }));
vi.mock('./audit-middleware', () => ({
  auditContextMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  auditResponseMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  auditErrorMiddleware: (_err: unknown, _req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('./notification-service');
vi.mock('./audit-service');
vi.mock('./audit-storage');
vi.mock('./reports-controller');
vi.mock('./report-service');

import { storage } from './storage';
import { registerRoutes } from './routes';

const app = express();
app.use(express.json());
let saved: { key: string; value: string; dataType: string };

beforeAll(async () => {
  // Route registration starts a daily cleanup timer; this suite exercises HTTP only.
  const timer = vi.spyOn(globalThis, 'setInterval').mockReturnValue({} as ReturnType<typeof setInterval>);
  try {
    await registerRoutes(app);
  } finally {
    timer.mockRestore();
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  saved = { key: 'timezone', value: 'America/Los_Angeles', dataType: 'string' };
  vi.mocked(storage.getAppConfig).mockImplementation(async () => ({ ...saved }) as any);
  vi.mocked(storage.getAppConfigValue).mockImplementation(async () => saved.value);
  vi.mocked(storage.updateAppConfig).mockImplementation(async (_key, value) => {
    saved = { ...saved, value };
    return { ...saved } as any;
  });
});

afterAll(() => vi.restoreAllMocks());

function patch(value: unknown, key = 'timezone') {
  return request(app).patch(`/api/admin/app-configs/${key}`)
    .set('x-test-role', 'admin').send({ value });
}

describe('PATCH /api/admin/app-configs/timezone', () => {
  it.each([
    'Not/A_Timezone', 'PCT', '', ' ', '\t\n', ' America/Los_Angeles ',
    123, true, false, [], {}, ['UTC'], null, undefined,
  ].map(value => ({ value })))('rejects invalid value $value without changing the previous valid setting', async ({ value }) => {
    const response = await patch(value);
    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(storage.updateAppConfig).not.toHaveBeenCalled();
    const stored = await request(app).get('/api/admin/app-configs/timezone')
      .set('x-test-role', 'admin');
    expect(stored.status).toBe(200);
    expect(stored.body.value).toBe('America/Los_Angeles');
    const clientSetting = await request(app).get('/api/app-configs/timezone');
    expect(clientSetting.body).toEqual({ key: 'timezone', value: 'America/Los_Angeles' });
  });

  // Keep every currently offered selector choice usable, without constraining
  // the endpoint to that list (other Intl-supported zones remain valid).
  const selectorOptions = [
    'America/Los_Angeles', 'America/Denver', 'America/Chicago',
    'America/New_York', 'America/Phoenix', 'America/Anchorage',
    'Pacific/Honolulu', 'UTC',
  ];

  it.each([...selectorOptions, 'America/Vancouver', 'Asia/Tokyo'])('persists supported timezone %s', async (value) => {
    const response = await patch(value);
    expect(response.status).toBe(200);
    expect(response.body.value).toBe(value);
    expect(storage.updateAppConfig).toHaveBeenCalledWith('timezone', value, 'admin-1');
    const stored = await request(app).get('/api/app-configs/timezone');
    expect(stored.body.value).toBe(value);
  });

  it('keeps all current timezone selector options', () => {
    const source = readFileSync(new URL('../client/src/pages/admin-data-management.tsx', import.meta.url), 'utf8');
    const selector = source.split('data-testid="select-edit-config-timezone"')[1].split('</select>')[0];
    const values = [...selector.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]);
    expect(values).toEqual(selectorOptions);
  });

  it('still requires admin access', async () => {
    expect((await request(app).patch('/api/admin/app-configs/timezone').send({ value: 'UTC' })).status).toBe(403);
    expect(storage.updateAppConfig).not.toHaveBeenCalled();
  });

  it('preserves the missing-config response', async () => {
    vi.mocked(storage.getAppConfig).mockResolvedValue(undefined);
    expect((await patch('UTC')).status).toBe(404);
    expect(storage.updateAppConfig).not.toHaveBeenCalled();
  });

  it('does not apply timezone validation to other string configs', async () => {
    saved = { key: 'week_start_day', value: 'sunday', dataType: 'string' };
    expect((await patch('monday', saved.key)).status).toBe(200);
    expect(saved.value).toBe('monday');
  });

  it('preserves numeric and positive timeout validation', async () => {
    saved = { key: 'lock_timeout_ms', value: '120000', dataType: 'number' };
    for (const value of ['not-a-number', 'Infinity', 0, -1]) {
      expect((await patch(value, saved.key)).status).toBe(400);
    }
    expect(storage.updateAppConfig).not.toHaveBeenCalled();
    expect((await patch(60000, saved.key)).status).toBe(200);
    expect(saved.value).toBe('60000');
  });
});
