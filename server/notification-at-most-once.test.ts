import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const axiosPost = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    post: axiosPost,
    isAxiosError: (error: any) => error?.isAxiosError === true,
  },
}));

vi.mock('@azure/msal-node', () => ({
  ConfidentialClientApplication: class {
    async acquireTokenByClientCredential() {
      return { accessToken: 'test-token' };
    }
  },
}));

vi.mock('./storage', () => ({ storage: {} }));

describe('at-most-once email provider selection', () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.MS365_TENANT_ID = 'tenant';
    process.env.MS365_CLIENT_ID = 'client';
    process.env.MS365_CLIENT_SECRET = 'secret';
    process.env.MS365_SENDER_EMAIL = 'sender@example.com';
    process.env.MANDRILL_API_KEY = 'mandrill-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not fall back to Mandrill after an ambiguous MS365 timeout', async () => {
    const timeout = Object.assign(new Error('timeout'), {
      isAxiosError: true,
      code: 'ECONNABORTED',
      response: undefined,
    });
    axiosPost.mockRejectedValue(timeout);

    const { sendEmailNotification } = await import('./notification-service');
    const result = await sendEmailNotification({
      to: 'owner@example.com',
      subject: 'Milestone',
      text: 'Milestone',
      html: '<p>Milestone</p>',
      type: 'general',
    }, { allowProviderFallback: false });

    expect(axiosPost).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      success: false,
      provider: 'ms365',
      ambiguous: true,
    }));
  });

  it('uses the professional milestone format without a long dash', async () => {
    const { createOwnerRentalMilestoneEmail } = await import('./notification-service');
    const email = createOwnerRentalMilestoneEmail(
      { name: 'Acceptance Tester', email: 'owner@example.com' },
      100,
      { isTest: true },
    );

    expect(email.subject).toBe('[TEST] Thank you for helping ParkShare reach 100 bookings');
    expect(email.subject).not.toContain('—');
    expect(email.html).toContain('background:#003f67');
    expect(email.html).toContain('color:#31c4cf');
    expect(email.html).toContain('Peer bookings made possible');
    expect(email.html).not.toContain('info-card');
  });
});