import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { newErrorReference, logServerError, withReference, respondWithServerError } from './error-reporting';

function makeReq(overrides: Record<string, any> = {}) {
  return {
    method: 'POST',
    path: '/api/admin/schedule-release',
    originalUrl: '/api/admin/schedule-release',
    auditContext: { correlationId: 'corr-123' },
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: any) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe('error reporting helpers', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('generates short, quotable reference codes', () => {
    const ref = newErrorReference();
    expect(ref).toMatch(/^[0-9A-F]{6}$/);
    expect(newErrorReference()).not.toBe(ref);
  });

  it('logs method, path, stack and correlation id for a failure', () => {
    const error = new Error('connection terminated unexpectedly');
    const reference = logServerError('admin:schedule-release', error, makeReq());

    const logged = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain(reference);
    expect(logged).toContain('POST');
    expect(logged).toContain('/api/admin/schedule-release');
    expect(logged).toContain('corr-123');
    expect(logged).toContain('connection terminated unexpectedly');
    expect(logged).toContain('error-reporting.test.ts'); // stack frames present
  });

  it('still logs something useful for an error that carries no message', () => {
    const reference = logServerError('admin:schedule-release', new Error(''), makeReq());
    const logged = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain(reference);
    expect(logged).toContain('message=Error');
  });

  it('answers with a specific reason plus the reference, never a bare generic string', () => {
    const res = makeRes();
    respondWithServerError(
      makeReq(),
      res,
      'admin:schedule-release',
      new Error(''),
      'Could not save the scheduled release for spot P60 on 2026-09-26.',
      { partial: true },
    );

    expect(res.statusCode).toBe(500);
    expect(res.body.reference).toMatch(/^[0-9A-F]{6}$/);
    expect(res.body.error).toBe(res.body.message);
    expect(res.body.error).toContain('Could not save the scheduled release for spot P60');
    expect(res.body.error).toContain(res.body.reference);
    expect(res.body.error).not.toBe('Internal Server Error');
    expect(res.body.partial).toBe(true);
  });

  it('appends the reference to a message', () => {
    expect(withReference('Something specific failed.', 'ABC123')).toBe(
      'Something specific failed. (reference: ABC123)',
    );
  });
});
