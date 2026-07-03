import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttestationCard } from '@/components/attestation-card';
import type { EnrichedAttestationResult } from '@/lib/attestation-queries';

describe('AttestationCard', () => {
  const baseAttestation: EnrichedAttestationResult = {
    uid: '0x' + '1'.repeat(64),
    attester: '0x1234567890123456789012345678901234567890',
    recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    data: '0x',
    time: Math.floor(Date.now() / 1000) - 86400,
    expirationTime: 0,
    revocationTime: 0,
    refUID: '0x' + '0'.repeat(64),
    revocable: false,
    schemaId: 'certification',
    schemaTitle: 'Certification',
  };

  it('renders without crashing', () => {
    const onClick = () => {};
    render(<AttestationCard attestation={baseAttestation} onClick={onClick} />);
  });

  it('renders schema title', () => {
    render(<AttestationCard attestation={baseAttestation} onClick={() => {}} />);
    expect(screen.getByText('Certification')).toBeInTheDocument();
  });

  it('renders full attester address (no shortening)', () => {
    render(<AttestationCard attestation={baseAttestation} onClick={() => {}} />);
    expect(screen.getByText(baseAttestation.attester)).toBeInTheDocument();
  });

  it('renders subject from recipient (full address) when no decodedData', () => {
    render(<AttestationCard attestation={baseAttestation} onClick={() => {}} />);
    expect(screen.getByText(baseAttestation.recipient)).toBeInTheDocument();
  });

  it('renders subject from decodedData when available', () => {
    const att = {
      ...baseAttestation,
      decodedData: { subject: 'did:web:example.com:app' },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByText('did:web:example.com:app')).toBeInTheDocument();
  });

  it('renders StarRating with accessible label when decodedData.ratingValue exists', () => {
    const att = {
      ...baseAttestation,
      schemaId: 'user-review',
      schemaTitle: 'User Review',
      decodedData: { ratingValue: 4 },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByLabelText('4 out of 5 stars')).toBeInTheDocument();
  });

  it('does not render rating block when ratingValue is absent', () => {
    render(<AttestationCard attestation={baseAttestation} onClick={() => {}} />);
    expect(screen.queryByText(/^Rating:/)).not.toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn();
    render(<AttestationCard attestation={baseAttestation} onClick={onClick} />);
    const card = screen.getByText('Certification').closest('[class*="cursor-pointer"]');
    expect(card).toBeInTheDocument();
    if (card) {
      fireEvent.click(card);
      expect(onClick).toHaveBeenCalled();
    }
  });
});
