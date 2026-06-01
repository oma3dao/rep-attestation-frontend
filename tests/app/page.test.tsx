import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const routerPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/blockchain', () => ({
  useWallet: () => ({ chainId: undefined, address: undefined, isConnected: false }),
}));

vi.mock('@/lib/attestation-queries', () => ({
  getLatestAttestationsWithMetadata: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/components/backend-session-provider', () => ({
  useBackendSession: () => ({ session: null, openAuthDialog: vi.fn() }),
}));

vi.mock('@/components/latest-attestations', () => ({
  LatestAttestations: () => <div data-testid="latest-attestations">Latest Attestations</div>,
}));

vi.mock('@/components/home/LatestTrustProfiles', () => ({
  LatestTrustProfiles: () => <div data-testid="latest-trust-profiles">Trust profiles list</div>,
}));

import Page from '@/app/page';

describe('Main Page', () => {
  it('renders without crashing', () => {
    render(<Page />);
  });

  it('renders the OMATrust Portal heading', () => {
    render(<Page />);
    expect(screen.getByRole('heading', { name: /OMATrust Portal/i })).toBeInTheDocument();
  });

  it('renders all workflow CTA cards', () => {
    render(<Page />);
    expect(screen.getByText('Review an app or service')).toBeInTheDocument();
    expect(screen.getByText('Manage your trust')).toBeInTheDocument();
    expect(screen.getByText('Auditors & certifiers')).toBeInTheDocument();
    expect(screen.getByText('Build with OMATrust')).toBeInTheDocument();
  });

  it('renders an external link to the API docs', () => {
    render(<Page />);
    const docsLink = screen
      .getAllByRole('link')
      .find(link => link.getAttribute('href') === 'https://docs.omatrust.org');
    expect(docsLink).toBeDefined();
    expect(docsLink).toHaveAttribute('target', '_blank');
  });

  it('renders the Latest Trust Profiles and Latest Activity sections', () => {
    render(<Page />);
    expect(screen.getByText('Latest Trust Profiles')).toBeInTheDocument();
    expect(screen.getByText('Latest Activity')).toBeInTheDocument();
    expect(screen.getByTestId('latest-trust-profiles')).toBeInTheDocument();
    expect(screen.getByTestId('latest-attestations')).toBeInTheDocument();
  });
});
