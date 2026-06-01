import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DidJwkInput } from '@/components/did-jwk-input';

// Base64url (no padding) of {"kty":"EC"} — a minimally valid JWK.
const VALID_JWK = 'eyJrdHkiOiJFQyJ9';
// Base64url of {"a":1} — valid JSON but no `kty`.
const JSON_WITHOUT_KTY = 'eyJhIjoxfQ';

describe('DidJwkInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the did:jwk prefix and input', () => {
    render(<DidJwkInput onChange={vi.fn()} />);
    expect(screen.getByText('did:jwk:')).toBeInTheDocument();
    expect(screen.getByLabelText(/Public Key/i)).toBeInTheDocument();
  });

  it('pre-fills the input from an existing did:jwk value', () => {
    render(<DidJwkInput value={`did:jwk:${VALID_JWK}`} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Public Key/i)).toHaveValue(VALID_JWK);
  });

  it('calls onChange(null) on blur when the input is empty', () => {
    const onChange = vi.fn();
    render(<DidJwkInput onChange={onChange} />);
    fireEvent.blur(screen.getByLabelText(/Public Key/i));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('rejects values with non-base64url characters', () => {
    const onChange = vi.fn();
    render(<DidJwkInput onChange={onChange} />);
    const input = screen.getByLabelText(/Public Key/i);
    fireEvent.change(input, { target: { value: 'has spaces!' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText(/Invalid format/i)).toBeInTheDocument();
  });

  it('rejects a decoded JWK that is missing the kty field', () => {
    const onChange = vi.fn();
    render(<DidJwkInput onChange={onChange} />);
    const input = screen.getByLabelText(/Public Key/i);
    fireEvent.change(input, { target: { value: JSON_WITHOUT_KTY } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText(/missing 'kty'/i)).toBeInTheDocument();
  });

  it('rejects a value that does not decode to valid JSON', () => {
    const onChange = vi.fn();
    render(<DidJwkInput onChange={onChange} />);
    const input = screen.getByLabelText(/Public Key/i);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText(/Could not decode as valid JWK/i)).toBeInTheDocument();
  });

  it('accepts a valid base64url-encoded JWK and emits the full DID', () => {
    const onChange = vi.fn();
    render(<DidJwkInput onChange={onChange} />);
    const input = screen.getByLabelText(/Public Key/i);
    fireEvent.change(input, { target: { value: VALID_JWK } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(`did:jwk:${VALID_JWK}`);
    expect(screen.getByText(/Valid JWK format/i)).toBeInTheDocument();
    expect(screen.getByText(`did:jwk:${VALID_JWK}`)).toBeInTheDocument();
  });

  it('renders an external error when provided', () => {
    render(<DidJwkInput value={`did:jwk:${VALID_JWK}`} onChange={vi.fn()} error="Something is wrong" />);
    expect(screen.getByText('Something is wrong')).toBeInTheDocument();
  });
});
