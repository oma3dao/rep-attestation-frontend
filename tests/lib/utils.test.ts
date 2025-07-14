// Unit test for extractAddressFromDID utility function
// Covers: parsing various DID/address formats and error handling

import { extractAddressFromDID, cn } from '../../src/lib/utils';

describe('extractAddressFromDID utility', () => {
  it('extracts address from DID:PKH', () => {
    expect(
      extractAddressFromDID('did:pkh:eip155:1:0x742d35Cc6634C0532925a3b844Bc454e4438f44e')
    ).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
  });

  it('extracts address from DID:ETHR', () => {
    expect(
      extractAddressFromDID('did:ethr:0x742d35Cc6634C0532925a3b844Bc454e4438f44e')
    ).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    expect(
      extractAddressFromDID('did:ethr:goerli:0x742d35Cc6634C0532925a3b844Bc454e4438f44e')
    ).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
  });

  it('extracts address from CAIP-10', () => {
    expect(
      extractAddressFromDID('eip155:1:0x742d35Cc6634C0532925a3b844Bc454e4438f44e')
    ).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
  });

  it('returns address if already an Ethereum address', () => {
    expect(
      extractAddressFromDID('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')
    ).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
  });

  it('returns zero address for non-Ethereum DIDs', () => {
    expect(
      extractAddressFromDID('did:web:example.com')
    ).toBe('0x0000000000000000000000000000000000000000');
  });

  it('throws for unsupported formats', () => {
    expect(() => extractAddressFromDID('foo:bar')).toThrow();
  });
});

describe('extractAddressFromDID uncovered branches', () => {
  it('throws for DID:PKH with wrong number of parts', () => {
    expect(() => extractAddressFromDID('did:pkh:eip155:1')).toThrow(/Invalid DID:PKH CAIP-10 format/);
  });
  it('throws for DID:PKH with unsupported namespace', () => {
    expect(() => extractAddressFromDID('did:pkh:foo:1:0x742d35Cc6634C0532925a3b844Bc454e4438f44e')).toThrow(/Unsupported DID:PKH namespace/);
  });
  it('throws for DID:ETHR with wrong number of parts', () => {
    expect(() => extractAddressFromDID('did:ethr:foo:bar:baz')).toThrow(/Invalid DID:ETHR format/);
  });
  it('throws for CAIP-10 with wrong number of parts', () => {
    expect(() => extractAddressFromDID('eip155:1')).toThrow(/Invalid CAIP-10 address format/);
  });
});

describe('extractAddressFromDID remaining branch coverage', () => {
  it('throws for DID:PKH with eip155 but address not starting with 0x', () => {
    expect(() => extractAddressFromDID('did:pkh:eip155:1:742d35Cc6634C0532925a3b844Bc454e4438f44e')).toThrow(/Invalid DID:PKH CAIP-10 format/);
  });
  it('throws for DID:PKH with eip155 but address wrong length', () => {
    expect(() => extractAddressFromDID('did:pkh:eip155:1:0x123')).toThrow(/Invalid DID:PKH CAIP-10 format/);
  });
  it('throws for DID:ETHR with address not starting with 0x (1-part)', () => {
    expect(() => extractAddressFromDID('did:ethr:742d35Cc6634C0532925a3b844Bc454e4438f44e')).toThrow(/Invalid DID:ETHR format/);
  });
  it('throws for DID:ETHR with address wrong length (1-part)', () => {
    expect(() => extractAddressFromDID('did:ethr:0x123')).toThrow(/Invalid DID:ETHR format/);
  });
  it('throws for DID:ETHR with address not starting with 0x (2-part)', () => {
    expect(() => extractAddressFromDID('did:ethr:goerli:742d35Cc6634C0532925a3b844Bc454e4438f44e')).toThrow(/Invalid DID:ETHR format/);
  });
  it('throws for DID:ETHR with address wrong length (2-part)', () => {
    expect(() => extractAddressFromDID('did:ethr:goerli:0x123')).toThrow(/Invalid DID:ETHR format/);
  });
  it('throws for CAIP-10 with address not starting with 0x', () => {
    expect(() => extractAddressFromDID('eip155:1:742d35Cc6634C0532925a3b844Bc454e4438f44e')).toThrow(/Invalid CAIP-10 address format/);
  });
  it('throws for CAIP-10 with address wrong length', () => {
    expect(() => extractAddressFromDID('eip155:1:0x123')).toThrow(/Invalid CAIP-10 address format/);
  });
});

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });
  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', undefined, null, 'baz')).toBe('foo baz');
  });
  it('dedupes tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
  it('returns empty string for no input', () => {
    expect(cn()).toBe('');
  });
}); 