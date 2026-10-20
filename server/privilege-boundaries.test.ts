import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.hoisted(() => {
  // Import real authorization without requiring a running OIDC provider.
  process.env.REPLIT_DOMAINS ||= 'test.example.invalid';
});
vi.mock('./db', () => ({ db: {}, pool: { on: vi.fn() } }));
vi.mock('./storage', () => ({
  storage: {
    getUser: vi.fn(),
    upsertUser: vi.fn(),
    addUserRole: vi.fn(),
    getWaitingListById: vi.fn(),
    assignWaitingListUser: vi.fn(),
    getAppConfigValue: vi.fn(),
    deleteInternalConfigsBefore: vi.fn(async () => 0),
    getAllTermsVersions: vi.fn(async () => [{ version: 1 }]),
    getActiveTermsVersion: vi.fn(async () => ({ version: 1 })),
  },
}));
vi.mock('./replitAuth', async (importOriginal) => ({
  ...await importOriginal<typeof import('./replitAuth')>(),
  setupAuth: vi.fn(async () => undefined),
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
import { auditService } from './audit-service';
import { sendAssignmentNotification } from './notification-service';
import { registerRoutes } from './routes';

const app = express();
app.use(express.json());
// Simulate Passport's server-verified session, not a production request header.
app.use((req: any, _res, next) => {
  const role = req.headers['x-test-session-role'];
  req.isAuthenticated = () => Boolean(role);
  if (role) {
    req.user = {
      claims: { sub: 'caller' },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    req.session = { viewAsRole: req.headers['x-test-view-as'] };
  }
  next();
});

const waitingEntry = {
  id: 'entry-1', userId: 'waiting-user', userName: 'Waiting User',
  userEmail: 'waiting@example.invalid', status: 'waiting',
};
const assignedEntry = { ...waitingEntry, status: 'assigned', assignedSpotId: 'spot-1' };

beforeAll(async () => {
  const timer = vi.spyOn(globalThis, 'setInterval').mockReturnValue({} as ReturnType<typeof setInterval>);
  try {
    await registerRoutes(app);
  } finally {
    timer.mockRestore();
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(storage.getWaitingListById).mockResolvedValue(waitingEntry as any);
  vi.mocked(storage.assignWaitingListUser).mockResolvedValue(assignedEntry as any);
  vi.mocked(sendAssignmentNotification).mockResolvedValue({ email: true } as any);
});
afterAll(() => vi.restoreAllMocks());

function post(path: string, role?: string, viewAs?: string) {
  vi.mocked(storage.getUser).mockResolvedValue({
    id: 'caller', roles: role ? [role] : [], firstName: 'Test', lastName: 'User',
  } as any);
  const req = request(app).post(path);
  if (role) req.set('x-test-session-role', role);
  if (viewAs) req.set('x-test-view-as', viewAs);
  return req;
}

function expectNoPrivilegedEffects() {
  expect(storage.addUserRole).not.toHaveBeenCalled();
  expect(storage.upsertUser).not.toHaveBeenCalled();
  expect(storage.getWaitingListById).not.toHaveBeenCalled();
  expect(storage.assignWaitingListUser).not.toHaveBeenCalled();
  expect(auditService.logAction).not.toHaveBeenCalled();
  expect(sendAssignmentNotification).not.toHaveBeenCalled();
}

describe.each([
  '/api/auth/promote-to-admin',
  '/api/waiting-list/entry-1/assign',
])('privilege boundary: POST %s', (path) => {
  it('rejects anonymous callers before any privileged effects', async () => {
    const response = await post(path).send({ spotId: 'spot-1' });
    expect(response.status).toBe(401);
    expectNoPrivilegedEffects();
  });

  it.each([undefined, 'renter', 'owner'])(
    'rejects a forged demo admin header with session role %s in development',
    async (role) => {
      vi.stubEnv('NODE_ENV', 'development');
      try {
        const response = await post(path, role)
          .set('x-demo-auth', JSON.stringify({ id: 'caller', roles: ['admin'] }))
          .send({ spotId: 'spot-1' });
        expect(response.status).toBe(401);
        expectNoPrivilegedEffects();
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it.each(['renter', 'owner'])('rejects a signed-in %s', async (role) => {
    const response = await post(path, role).send({ spotId: 'spot-1' });
    expect(response.status).toBe(403);
    expectNoPrivilegedEffects();
  });

  it('does not trust a forged admin view-as role', async () => {
    const response = await post(path, 'renter', 'admin').send({ spotId: 'spot-1' });
    expect(response.status).toBe(403);
    expectNoPrivilegedEffects();
  });
});

describe('authorized behavior', () => {
  it('allows an existing admin to use the role endpoint', async () => {
    const response = await post('/api/auth/promote-to-admin', 'admin').send({});
    expect(response.status).toBe(200);
    expect(storage.addUserRole).toHaveBeenCalledExactlyOnceWith('caller', 'admin');
    expect(auditService.logAction).toHaveBeenCalledWith('UPDATE', 'user', expect.any(Object));
  });

  it('allows a base admin viewing as renter to assign and notify', async () => {
    const response = await post('/api/waiting-list/entry-1/assign', 'admin', 'renter')
      .send({ spotId: 'spot-1' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(assignedEntry);
    expect(storage.assignWaitingListUser).toHaveBeenCalledExactlyOnceWith('entry-1', 'spot-1');
    expect(auditService.logAction).toHaveBeenCalledWith('ASSIGN', 'waiting_list', expect.any(Object));
    expect(sendAssignmentNotification).toHaveBeenCalledExactlyOnceWith(
      { id: waitingEntry.userId, name: waitingEntry.userName, email: waitingEntry.userEmail },
      waitingEntry, expect.any(Object), { emailNotifications: true, pushNotifications: true },
    );
  });

  it('still validates required spot ID for admins', async () => {
    expect((await post('/api/waiting-list/entry-1/assign', 'admin').send({})).status).toBe(400);
    expectNoPrivilegedEffects();
  });

  it('still returns not found for a missing waiting-list entry', async () => {
    vi.mocked(storage.getWaitingListById).mockResolvedValue(undefined);
    const response = await post('/api/waiting-list/missing/assign', 'admin').send({ spotId: 'spot-1' });
    expect(response.status).toBe(404);
    expect(storage.assignWaitingListUser).not.toHaveBeenCalled();
    expect(sendAssignmentNotification).not.toHaveBeenCalled();
  });
});
