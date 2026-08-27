import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttestationDetailModal } from '@/components/attestation-detail-modal';
import type { EnrichedAttestationResult } from '@/lib/attestation-queries';

const EXPLORER_URL = 'https://explorer.testnet.chain.oma3.org';
const TX_HASH = '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';

vi.mock('@/lib/blockchain', () => ({
  getActiveChain: () => ({
    id: 66238,
    blockExplorers: [{ name: 'Explorer', url: EXPLORER_URL }],
  }),
}));

describe('AttestationDetailModal', () => {
  const baseAttestation: EnrichedAttestationResult = {
    uid: '0x' + '1'.repeat(64),
    attester: '0x' + 'ab'.repeat(20),
    recipient: '0x' + 'cd'.repeat(20),
    data: '0x',
    time: Math.floor(Date.now() / 1000) - 86400,
    expirationTime: 0,
    revocationTime: 0,
    refUID: '0x' + '0'.repeat(64),
    revocable: false,
    schemaId: 'certification',
    schemaTitle: 'Certification',
  };

  it('returns null when attestation is null', () => {
    const { container } = render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders schema title and date when open', () => {
    render(
      <AttestationDetailModal
        isOpen={true}
        onClose={() => {}}
        attestation={baseAttestation}
      />
    );
    expect(screen.getByText('Certification')).toBeInTheDocument();
  });

  it('renders UID, attester, and recipient', () => {
    render(
      <AttestationDetailModal
        isOpen={true}
        onClose={() => {}}
        attestation={baseAttestation}
      />
    );
    expect(screen.getByText(/UID:/i)).toBeInTheDocument();
    expect(screen.getByText(/Attester:/i)).toBeInTheDocument();
    expect(screen.getByText(/Recipient:/i)).toBeInTheDocument();
    expect(screen.getByText(baseAttestation.uid)).toBeInTheDocument();
  });

  it('renders View Attester on Block Explorer link', () => {
    render(
      <AttestationDetailModal
        isOpen={true}
        onClose={() => {}}
        attestation={baseAttestation}
      />
    );
    const link = screen.getByRole('link', { name: /view attester on block explorer/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', expect.stringContaining('/address/'));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders Attestation Data section when decodedData is present', () => {
    const att = {
      ...baseAttestation,
      decodedData: { subject: 'did:web:example.com', ratingValue: 4 },
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText(/Attestation Data/i)).toBeInTheDocument();
    expect(screen.getByText('did:web:example.com')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders Expires when expirationTime > 0', () => {
    const att = {
      ...baseAttestation,
      expirationTime: Math.floor(Date.now() / 1000) + 86400,
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText(/Expires:/i)).toBeInTheDocument();
  });

  it('renders revocation notice when revocationTime > 0', () => {
    const att = {
      ...baseAttestation,
      revocationTime: Math.floor(Date.now() / 1000) - 3600,
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText(/revoked on/i)).toBeInTheDocument();
  });

  it('formats null and undefined decodedData values as empty string', () => {
    const att = {
      ...baseAttestation,
      decodedData: { empty: null, missing: undefined, text: 'ok' },
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText(/Attestation Data/i)).toBeInTheDocument();
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('formats BigInt decodedData values as string', () => {
    const att = {
      ...baseAttestation,
      decodedData: { count: BigInt(42), label: 'items' },
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('items')).toBeInTheDocument();
  });

  it('formats non-serializable object with String fallback', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const att = {
      ...baseAttestation,
      decodedData: { broken: circular },
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText(/Attestation Data/i)).toBeInTheDocument();
  });

  it('renders View transaction onchain link with /tx/{txHash} when txHash is present', () => {
    const att = {
      ...baseAttestation,
      txHash: TX_HASH,
    } as EnrichedAttestationResult;
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    const link = screen.getByRole('link', { name: /view transaction onchain/i });
    expect(link).toHaveAttribute('href', `${EXPLORER_URL}/tx/${TX_HASH}`);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders Verification Passed with valid checks and status badges', () => {
    const att = {
      ...baseAttestation,
      verification: {
        valid: true,
        checks: { revocation: true, expiration: true, proofs: true },
        reasons: [],
      },
    } as EnrichedAttestationResult;
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Not revoked')).toBeInTheDocument();
    expect(screen.getByText('Not expired')).toBeInTheDocument();
    expect(screen.getAllByText('Verified').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Verification failed with Not verified and reason list', () => {
    const att = {
      ...baseAttestation,
      verification: {
        valid: false,
        checks: { revocation: false, expiration: true, proofs: false },
        reasons: ['Attestation has been revoked', 'Proof verification failed'],
      },
    } as EnrichedAttestationResult;
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getAllByText('Not verified').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('Attestation has been revoked')).toBeInTheDocument();
    expect(screen.getByText('Proof verification failed')).toBeInTheDocument();
  });

  it('formats camelCase check names as spaced labels', () => {
    const att = {
      ...baseAttestation,
      verification: {
        valid: true,
        checks: { schemaMatch: true },
        reasons: [],
      },
    } as EnrichedAttestationResult;
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText('schema Match')).toBeInTheDocument();
  });

  it('formats observedAt in seconds as a locale date string', () => {
    const seconds = 1700000000;
    const att = {
      ...baseAttestation,
      decodedData: { observedAt: seconds },
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText(new Date(seconds * 1000).toLocaleString())).toBeInTheDocument();
  });

  it('formats observedAt in milliseconds (>1e12) as a locale date string', () => {
    const ms = 1700000000000;
    const att = {
      ...baseAttestation,
      decodedData: { observedAt: ms },
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText(new Date(ms).toLocaleString())).toBeInTheDocument();
  });

  it('formats observedAt bigint values', () => {
    const seconds = BigInt(1700000000);
    const att = {
      ...baseAttestation,
      decodedData: { observedAt: seconds },
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText(new Date(Number(seconds) * 1000).toLocaleString())).toBeInTheDocument();
  });

  it('falls back to string value for invalid or zero observedAt', () => {
    const att = {
      ...baseAttestation,
      decodedData: { observedAt: 0, observed_at: -1 },
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  it('serializes nested objects with BigInt values in decodedData', () => {
    const att = {
      ...baseAttestation,
      decodedData: { nested: { count: BigInt(1) } },
    };
    render(
      <AttestationDetailModal isOpen={true} onClose={() => {}} attestation={att} />
    );
    expect(screen.getByText(/"count": "1"/)).toBeInTheDocument();
  });
});
