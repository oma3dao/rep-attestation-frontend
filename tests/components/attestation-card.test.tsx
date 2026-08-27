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

  it('renders responsibility claim fields when present', () => {
    const att = {
      ...baseAttestation,
      schemaId: 'responsibility-claim',
      schemaTitle: 'Responsibility Claim',
      decodedData: {
        subject: 'did:artifact:bafkreiabc',
        responsibleParty: 'did:web:example.com',
        subjectLabel: 'Release manifest',
        responsibilityType: ['creator', 'maintainer'],
      },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByText('did:web:example.com')).toBeInTheDocument();
    expect(screen.getByText('Release manifest')).toBeInTheDocument();
    expect(screen.getByText('creator')).toBeInTheDocument();
    expect(screen.getByText('maintainer')).toBeInTheDocument();
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

  it('renders a Revoked badge when revocationTime is set', () => {
    const att = { ...baseAttestation, revocationTime: 1700000000 };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('renders a Trusted badge when trusted is true', () => {
    render(<AttestationCard attestation={baseAttestation} trusted onClick={() => {}} />);
    expect(screen.getByText('Trusted')).toBeInTheDocument();
  });

  it('renders a Verified badge when verification is valid', () => {
    const att = {
      ...baseAttestation,
      verification: {
        valid: true,
        checks: { revocation: true, expiration: true },
        reasons: [],
      },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders controller-witness controller and method fields', () => {
    const att = {
      ...baseAttestation,
      schemaId: 'controller-witness',
      schemaTitle: 'Controller Witness',
      decodedData: {
        subject: 'did:web:example.com',
        controller: 'did:jwk:eyJrdHkiOiJPS1AifQ',
        method: 'dns-txt',
      },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByText('did:jwk:eyJrdHkiOiJPS1AifQ')).toBeInTheDocument();
    expect(screen.getByText('dns txt')).toBeInTheDocument();
  });

  it('renders verification Status Passed with check badges for non-user-review schemas', () => {
    const att = {
      ...baseAttestation,
      verification: {
        valid: true,
        checks: { revocation: true, expiration: true, proofs: true },
        reasons: [],
      },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Not revoked')).toBeInTheDocument();
    expect(screen.getByText('Not expired')).toBeInTheDocument();
  });

  it('renders failed verification checks and reason list', () => {
    const att = {
      ...baseAttestation,
      verification: {
        valid: false,
        checks: { revocation: false, expiration: true },
        reasons: ['Attestation has been revoked'],
      },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByText('Not verified')).toBeInTheDocument();
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('Attestation has been revoked')).toBeInTheDocument();
  });

  it('does not render Status panel for user-review with verification', () => {
    const att = {
      ...baseAttestation,
      schemaId: 'user-review',
      schemaTitle: 'User Review',
      decodedData: { ratingValue: 4 },
      verification: {
        valid: true,
        checks: { revocation: true },
        reasons: [],
      },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.queryByText('Status:')).not.toBeInTheDocument();
    expect(screen.getByLabelText('4 out of 5 stars')).toBeInTheDocument();
  });

  it('formats controller-witness observedAt from seconds', () => {
    const seconds = 1700000000;
    const att = {
      ...baseAttestation,
      schemaId: 'controller-witness',
      schemaTitle: 'Controller Witness',
      decodedData: { observedAt: seconds },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByText(new Date(seconds * 1000).toLocaleDateString())).toBeInTheDocument();
  });

  it('formats controller-witness observedAt from milliseconds', () => {
    const ms = 1700000000000;
    const att = {
      ...baseAttestation,
      schemaId: 'controller-witness',
      schemaTitle: 'Controller Witness',
      decodedData: { observedAt: ms },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByText(new Date(ms).toLocaleDateString())).toBeInTheDocument();
  });

  it('shows Unknown for invalid controller-witness observedAt', () => {
    const att = {
      ...baseAttestation,
      schemaId: 'controller-witness',
      schemaTitle: 'Controller Witness',
      decodedData: { observedAt: -1 },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('does not show top Verified badge when verification.valid is false', () => {
    const att = {
      ...baseAttestation,
      verification: {
        valid: false,
        checks: { proofs: false },
        reasons: ['Proof check failed'],
      },
    };
    render(<AttestationCard attestation={att} onClick={() => {}} />);
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    expect(screen.getAllByText('Not verified').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Proof check failed')).toBeInTheDocument();
  });
});
