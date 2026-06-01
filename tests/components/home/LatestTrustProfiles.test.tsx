import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockUseWallet = vi.fn();
const mockGetLatest = vi.fn();

vi.mock('@/lib/blockchain', () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock('@/lib/attestation-queries', () => ({
  getLatestAttestationsWithMetadata: (...args: unknown[]) => mockGetLatest(...args),
}));

import { LatestTrustProfiles } from '@/components/home/LatestTrustProfiles';

function att(overrides: Record<string, unknown> = {}) {
  return {
    uid: '0x' + Math.random().toString(16).slice(2).padEnd(64, '0'),
    schemaId: 'key-binding',
    recipient: '0x9999999999999999999999999999999999999999',
    decodedData: { subject: 'did:web:example.com' },
    time: 1000,
    revocationTime: 0,
    ...overrides,
  };
}

describe('LatestTrustProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({ chainId: 66238 });
  });

  it('builds profiles from pre-fetched data without fetching', async () => {
    render(<LatestTrustProfiles data={[att()] as never} />);
    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
    expect(mockGetLatest).not.toHaveBeenCalled();
  });

  it('marks the signing-key indicator for key-binding attestations', async () => {
    const { container } = render(<LatestTrustProfiles data={[att({ schemaId: 'key-binding' })] as never} />);
    await screen.findByText('example.com');
    // The "Signing key" indicator should be checked (CheckCircle2 has text-primary).
    expect(screen.getByText('Signing key')).toBeInTheDocument();
    expect(container.querySelector('svg.text-primary')).toBeTruthy();
  });

  it('extracts the domain from a did:web subject and truncates raw addresses', async () => {
    render(
      <LatestTrustProfiles
        data={[
          att({ schemaId: 'key-binding', decodedData: { subject: 'did:web:foo.example.org' }, time: 2 }),
          att({ schemaId: 'controller-witness', decodedData: undefined, recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdef1234', time: 1 }),
        ] as never}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('foo.example.org')).toBeInTheDocument();
      expect(screen.getByText('0xabcd...1234')).toBeInTheDocument();
    });
  });

  it('ignores revoked and non-trust attestations', async () => {
    render(
      <LatestTrustProfiles
        data={[
          att({ schemaId: 'user-review', decodedData: { subject: 'did:web:ignored.com' } }),
          att({ schemaId: 'key-binding', decodedData: { subject: 'did:web:revoked.com' }, revocationTime: 123 }),
          att({ schemaId: 'key-binding', decodedData: { subject: 'did:web:kept.com' } }),
        ] as never}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('kept.com')).toBeInTheDocument();
    });
    expect(screen.queryByText('ignored.com')).not.toBeInTheDocument();
    expect(screen.queryByText('revoked.com')).not.toBeInTheDocument();
  });

  it('respects the limit prop', async () => {
    render(
      <LatestTrustProfiles
        limit={1}
        data={[
          att({ schemaId: 'key-binding', decodedData: { subject: 'did:web:a.com' }, time: 5 }),
          att({ schemaId: 'key-binding', decodedData: { subject: 'did:web:b.com' }, time: 3 }),
        ] as never}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('a.com')).toBeInTheDocument();
    });
    expect(screen.queryByText('b.com')).not.toBeInTheDocument();
  });

  it('fetches attestations when no data prop is provided', async () => {
    mockGetLatest.mockResolvedValue([att({ schemaId: 'key-binding', decodedData: { subject: 'did:web:fetched.com' } })]);
    render(<LatestTrustProfiles />);
    await waitFor(() => {
      expect(screen.getByText('fetched.com')).toBeInTheDocument();
    });
    expect(mockGetLatest).toHaveBeenCalledWith(66238, 100);
  });

  it('shows an error message when the fetch fails', async () => {
    mockGetLatest.mockRejectedValue(new Error('network down'));
    render(<LatestTrustProfiles />);
    await waitFor(() => {
      expect(screen.getByText(/Error loading trust profiles: network down/i)).toBeInTheDocument();
    });
  });

  it('shows an empty state when there are no trust profiles', async () => {
    render(<LatestTrustProfiles data={[] as never} />);
    await waitFor(() => {
      expect(screen.getByText(/No trust profiles found yet/i)).toBeInTheDocument();
    });
  });
});
