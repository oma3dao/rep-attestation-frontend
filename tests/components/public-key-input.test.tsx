import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PublicKeyInput } from '@/components/public-key-input';
import { PublicKeyConversionError } from '@/lib/public-key-to-jwk';

const mockDetectFormat = vi.fn();
const mockConvertToDidJwk = vi.fn();

vi.mock('@/lib/public-key-to-jwk', async () => {
  class PublicKeyConversionError extends Error {
    code: string;
    constructor(message: string, code = 'CONVERSION_ERROR') {
      super(message);
      this.name = 'PublicKeyConversionError';
      this.code = code;
    }
  }

  return {
    PublicKeyConversionError,
    detectFormat: (...args: unknown[]) => mockDetectFormat(...args),
    convertToDidJwk: (...args: unknown[]) => mockConvertToDidJwk(...args),
  };
});

const RESOLVED_DID = 'did:jwk:eyJrdHkiOiJPS1AifQ';

describe('PublicKeyInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectFormat.mockReturnValue('unknown');
    mockConvertToDidJwk.mockResolvedValue({
      did: RESOLVED_DID,
      detectedFormat: 'did-jwk',
      keyDescription: 'OKP public key',
      jwk: { kty: 'OKP' },
    });
  });

  it('shows a live format hint while typing', () => {
    mockDetectFormat.mockReturnValue('did-jwk');
    render(<PublicKeyInput onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Public Key'), {
      target: { value: RESOLVED_DID },
    });

    expect(mockDetectFormat).toHaveBeenCalledWith(RESOLVED_DID);
    expect(screen.getByText('Detected: did:jwk identifier')).toBeInTheDocument();
  });

  it('shows the resolved did:jwk and calls onChange on blur success', async () => {
    const onChange = vi.fn();
    render(<PublicKeyInput onChange={onChange} />);

    const textarea = screen.getByLabelText('Public Key');
    fireEvent.change(textarea, { target: { value: RESOLVED_DID } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(mockConvertToDidJwk).toHaveBeenCalledWith(RESOLVED_DID);
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(RESOLVED_DID);
    });
    expect(screen.getByText('Resolved did:jwk:')).toBeInTheDocument();
    expect(screen.getByRole('code')).toHaveTextContent(RESOLVED_DID);
  });

  it('shows a private key rejection banner', async () => {
    mockConvertToDidJwk.mockRejectedValue(
      new PublicKeyConversionError(
        'Input contains private key material. Only public keys are accepted.',
        'PRIVATE_KEY_REJECTED'
      )
    );

    const onChange = vi.fn();
    render(<PublicKeyInput onChange={onChange} />);

    const textarea = screen.getByLabelText('Public Key');
    fireEvent.change(textarea, { target: { value: '-----BEGIN PRIVATE KEY-----' } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(screen.getByText('Private key detected')).toBeInTheDocument();
    });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows a generic conversion error', async () => {
    mockConvertToDidJwk.mockRejectedValue(
      new PublicKeyConversionError('Unsupported key format.')
    );

    const onChange = vi.fn();
    render(<PublicKeyInput onChange={onChange} />);

    const textarea = screen.getByLabelText('Public Key');
    fireEvent.change(textarea, { target: { value: 'not-a-key' } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(screen.getByText('Unsupported key format.')).toBeInTheDocument();
    });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renders an external error prop', () => {
    render(<PublicKeyInput onChange={vi.fn()} error="Key is required" />);
    expect(screen.getByText('Key is required')).toBeInTheDocument();
  });
});
