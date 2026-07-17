import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArtifactDidInput } from '@/components/artifact-did-input';

vi.mock('@oma3/omatrust/identity', () => ({
  artifactDidFromJson: vi.fn(),
  artifactDidFromBytes: vi.fn(),
  parseArtifactDid: vi.fn((did: string) => {
    if (did === 'did:artifact:bvalid') return { digestHex: 'abc' };
    throw new Error('low-level parse failure');
  }),
}));

describe('ArtifactDidInput', () => {
  it('shows a friendly error for short invalid did:artifact values', () => {
    const onChange = vi.fn();
    render(<ArtifactDidInput onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('DID'), {
      target: { value: 'did:artifact:invalid' },
    });

    expect(screen.getByText("This isn't a valid content ID. It should start with did:artifact:b...")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
