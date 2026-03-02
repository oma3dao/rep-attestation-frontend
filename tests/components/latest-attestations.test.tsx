import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LatestAttestations } from '@/components/latest-attestations';
import * as attestationQueries from '@/lib/attestation-queries';
import * as blockchain from '@/lib/blockchain';
import { Providers } from '@/components/providers';

vi.mock('@/lib/blockchain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/blockchain')>();
  return {
    ...actual,
    useWallet: vi.fn(),
  };
});

vi.mock('@/lib/attestation-queries', () => ({
  getLatestAttestationsWithMetadata: vi.fn(),
}));

describe('LatestAttestations', () => {
  beforeEach(() => {
    vi.mocked(blockchain.useWallet).mockReturnValue({
      address: null,
      chainId: 66238,
      isConnected: false,
      isChainSupported: true,
      isAttestationSupported: true,
    } as ReturnType<typeof blockchain.useWallet>);
  });

  it('shows loading state initially', () => {
    vi.mocked(attestationQueries.getLatestAttestationsWithMetadata).mockImplementation(
      () => new Promise(() => {})
    );
    const { container } = render(
      <Providers>
        <LatestAttestations />
      </Providers>
    );
    expect(screen.getByText(/latest attestations/i)).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows empty state when no attestations', async () => {
    vi.mocked(attestationQueries.getLatestAttestationsWithMetadata).mockResolvedValue([]);
    render(
      <Providers>
        <LatestAttestations />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText(/no attestations found yet/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(attestationQueries.getLatestAttestationsWithMetadata).mockRejectedValue(
      new Error('Network error')
    );
    render(
      <Providers>
        <LatestAttestations />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText(/error loading attestations/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows attestation cards when fetch succeeds', async () => {
    vi.mocked(attestationQueries.getLatestAttestationsWithMetadata).mockResolvedValue([
      {
        uid: '0x' + '1'.repeat(64),
        attester: '0x' + 'ab'.repeat(20),
        recipient: '0x' + 'cd'.repeat(20),
        data: '0x',
        time: Math.floor(Date.now() / 1000),
        expirationTime: 0,
        revocationTime: 0,
        refUID: '0x' + '0'.repeat(64),
        revocable: false,
        schemaId: 'certification',
        schemaTitle: 'Certification',
      },
    ]);
    render(
      <Providers>
        <LatestAttestations />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText('Certification')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('opens modal on card click and closes modal on close', async () => {
    vi.mocked(attestationQueries.getLatestAttestationsWithMetadata).mockResolvedValue([
      {
        uid: '0x' + '1'.repeat(64),
        attester: '0x' + 'ab'.repeat(20),
        recipient: '0x' + 'cd'.repeat(20),
        data: '0x',
        time: Math.floor(Date.now() / 1000),
        expirationTime: 0,
        revocationTime: 0,
        refUID: '0x' + '0'.repeat(64),
        revocable: false,
        schemaId: 'certification',
        schemaTitle: 'Certification',
      },
    ]);
    render(
      <Providers>
        <LatestAttestations />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText('Certification')).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByText('Certification'));
    await waitFor(() => {
      expect(screen.getByText(/UID:/i)).toBeInTheDocument();
    });
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByText(/UID:/i)).not.toBeInTheDocument();
    });
  });
});
