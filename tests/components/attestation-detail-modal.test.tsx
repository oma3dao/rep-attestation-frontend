import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AttestationDetailModal } from '@/components/attestation-detail-modal';
import type { AttestationQueryResult } from '@/lib/attestation-queries';

describe('AttestationDetailModal', () => {
  const baseAttestation: AttestationQueryResult = {
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

  it('renders View on Block Explorer link', () => {
    render(
      <AttestationDetailModal
        isOpen={true}
        onClose={() => {}}
        attestation={baseAttestation}
      />
    );
    const link = screen.getByRole('link', { name: /view on block explorer/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', expect.stringContaining('/tx/'));
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
});
