import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import AttestationPage from '@/app/attest/[type]/page';

describe('Attest [type] Page', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('redirects to the matching /publish/<type> route', async () => {
    await AttestationPage({ params: Promise.resolve({ type: 'certification' }) });
    expect(redirectMock).toHaveBeenCalledWith('/publish/certification');
  });

  it('preserves the dynamic type segment in the redirect target', async () => {
    await AttestationPage({ params: Promise.resolve({ type: 'user-review' }) });
    expect(redirectMock).toHaveBeenCalledWith('/publish/user-review');
  });

  it('propagates a rejected params promise', async () => {
    await expect(
      AttestationPage({ params: Promise.reject(new Error('fail')) })
    ).rejects.toThrow('fail');
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
