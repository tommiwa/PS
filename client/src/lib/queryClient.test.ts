import { describe, it, expect } from 'vitest';
import { readApiError } from './queryClient';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('readApiError', () => {
  it('surfaces the specific server message from an { error } body', async () => {
    const res = jsonResponse(500, {
      error: 'Could not save the scheduled release for spot P60 on 2026-09-26. (reference: 7F3A1C)',
      reference: '7F3A1C',
    });

    // Regression: the message must not be swallowed and replaced by the raw JSON body
    await expect(readApiError(res, 'fallback')).resolves.toBe(
      'Could not save the scheduled release for spot P60 on 2026-09-26. (reference: 7F3A1C)',
    );
  });

  it('falls back to { message } when there is no { error }', async () => {
    const res = jsonResponse(500, { message: 'The server failed while handling POST /api/x (reference: ABC123)' });

    await expect(readApiError(res, 'fallback')).resolves.toContain('reference: ABC123');
  });

  it('returns a plain-text body verbatim (e.g. a proxy-generated error)', async () => {
    const res = new Response('Internal Server Error', { status: 502 });

    await expect(readApiError(res, 'fallback')).resolves.toBe('Internal Server Error');
  });

  it('uses the fallback plus the status when the body is empty', async () => {
    const res = new Response('', { status: 503, statusText: 'Service Unavailable' });

    const message = await readApiError(res, 'Failed to load pending scheduled releases.');
    expect(message).toContain('Failed to load pending scheduled releases.');
    expect(message).toContain('503');
  });
});
