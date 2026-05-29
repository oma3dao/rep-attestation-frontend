import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import AttestPage from '@/app/attest/page';

describe('Attest Page', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('redirects to the /publish landing page', () => {
    AttestPage();
    expect(redirectMock).toHaveBeenCalledWith('/publish');
  });
});
