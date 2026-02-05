import { describe, it, expect } from 'vitest'
import {
  canonicalizeDID,
  computeDidHash,
  computeDidIndex,
  didToIndexAddress,
  validateDidIndex,
  normalizeDomain,
  isValidDid,
  extractDidMethod,
  extractDidIdentifier,
  normalizeDidWeb
} from '@/lib/did-index'

describe('did-index utilities', () => {
  describe('canonicalizeDID', () => {
    it('throws for invalid DID format (not starting with did:)', () => {
      expect(() => canonicalizeDID('invalid')).toThrow('Invalid DID format: must start with "did:"')
    })

    it('throws for DID with insufficient parts', () => {
      expect(() => canonicalizeDID('did:web')).toThrow('Invalid DID format: insufficient parts')
    })

    describe('did:web', () => {
      it('lowercases the host', () => {
        expect(canonicalizeDID('did:web:Example.COM')).toBe('did:web:example.com')
      })

      it('preserves the path', () => {
        expect(canonicalizeDID('did:web:Example.COM/path/to/resource')).toBe('did:web:example.com/path/to/resource')
      })

      it('handles host without path', () => {
        expect(canonicalizeDID('did:web:example.com')).toBe('did:web:example.com')
      })

      it('handles complex paths (preserves path case)', () => {
        // did:web only lowercases the host, path is preserved as-is
        expect(canonicalizeDID('did:web:Example.COM/users/Alice')).toBe('did:web:example.com/users/Alice')
      })
    })

    describe('did:pkh', () => {
      it('throws for invalid did:pkh format (wrong number of parts)', () => {
        expect(() => canonicalizeDID('did:pkh:eip155:1')).toThrow('Invalid did:pkh format: must have 5 parts')
      })

      it('lowercases the address', () => {
        expect(canonicalizeDID('did:pkh:eip155:1:0xABCDEF1234567890ABCDEF1234567890ABCDEF12'))
          .toBe('did:pkh:eip155:1:0xabcdef1234567890abcdef1234567890abcdef12')
      })

      it('preserves namespace and chainId', () => {
        expect(canonicalizeDID('did:pkh:eip155:137:0xABC123'))
          .toBe('did:pkh:eip155:137:0xabc123')
      })
    })

    describe('did:handle', () => {
      it('throws for invalid did:handle format (wrong number of parts)', () => {
        expect(() => canonicalizeDID('did:handle:twitter')).toThrow('Invalid did:handle format: must have 4 parts')
      })

      it('lowercases platform and username', () => {
        expect(canonicalizeDID('did:handle:Twitter:Alice'))
          .toBe('did:handle:twitter:alice')
      })

      it('handles already lowercase values', () => {
        expect(canonicalizeDID('did:handle:github:johndoe'))
          .toBe('did:handle:github:johndoe')
      })
    })

    describe('did:key', () => {
      it('preserves the key portion (case-sensitive)', () => {
        const keyDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
        expect(canonicalizeDID(keyDid)).toBe(keyDid)
      })
    })

    describe('unknown methods', () => {
      it('lowercases the entire DID for unknown methods', () => {
        expect(canonicalizeDID('did:unknown:SomeIdentifier'))
          .toBe('did:unknown:someidentifier')
      })
    })
  })

  describe('computeDidHash', () => {
    it('returns a 32-byte hex string', () => {
      const hash = computeDidHash('did:web:example.com')
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('returns consistent hash for same DID', () => {
      const hash1 = computeDidHash('did:web:example.com')
      const hash2 = computeDidHash('did:web:example.com')
      expect(hash1).toBe(hash2)
    })

    it('returns different hash for different DIDs', () => {
      const hash1 = computeDidHash('did:web:example.com')
      const hash2 = computeDidHash('did:web:other.com')
      expect(hash1).not.toBe(hash2)
    })

    it('canonicalizes before hashing', () => {
      const hash1 = computeDidHash('did:web:Example.COM')
      const hash2 = computeDidHash('did:web:example.com')
      expect(hash1).toBe(hash2)
    })
  })

  describe('computeDidIndex', () => {
    it('returns a valid Ethereum address', () => {
      const hash = computeDidHash('did:web:example.com')
      const index = computeDidIndex(hash)
      expect(index).toMatch(/^0x[a-f0-9]{40}$/)
    })

    it('returns consistent address for same hash', () => {
      const hash = computeDidHash('did:web:example.com')
      const index1 = computeDidIndex(hash)
      const index2 = computeDidIndex(hash)
      expect(index1).toBe(index2)
    })

    it('returns different address for different hashes', () => {
      const hash1 = computeDidHash('did:web:example.com')
      const hash2 = computeDidHash('did:web:other.com')
      const index1 = computeDidIndex(hash1)
      const index2 = computeDidIndex(hash2)
      expect(index1).not.toBe(index2)
    })
  })

  describe('didToIndexAddress', () => {
    it('converts DID directly to index address', () => {
      const address = didToIndexAddress('did:web:example.com')
      expect(address).toMatch(/^0x[a-f0-9]{40}$/)
    })

    it('returns consistent address for same DID', () => {
      const addr1 = didToIndexAddress('did:web:example.com')
      const addr2 = didToIndexAddress('did:web:example.com')
      expect(addr1).toBe(addr2)
    })

    it('handles different DID methods', () => {
      const webAddr = didToIndexAddress('did:web:example.com')
      const pkhAddr = didToIndexAddress('did:pkh:eip155:1:0xabc123')
      expect(webAddr).not.toBe(pkhAddr)
    })
  })

  describe('validateDidIndex', () => {
    it('returns true for valid DID and matching index', () => {
      const did = 'did:web:example.com'
      const index = didToIndexAddress(did)
      expect(validateDidIndex(did, index)).toBe(true)
    })

    it('returns true for case-insensitive address comparison', () => {
      const did = 'did:web:example.com'
      const index = didToIndexAddress(did)
      expect(validateDidIndex(did, index.toUpperCase())).toBe(true)
    })

    it('returns false for mismatched index', () => {
      const did = 'did:web:example.com'
      const wrongIndex = '0x0000000000000000000000000000000000000000'
      expect(validateDidIndex(did, wrongIndex)).toBe(false)
    })

    it('returns false for invalid DID', () => {
      expect(validateDidIndex('invalid', '0x0000000000000000000000000000000000000000')).toBe(false)
    })
  })

  describe('normalizeDomain', () => {
    it('lowercases the domain', () => {
      expect(normalizeDomain('Example.COM')).toBe('example.com')
    })

    it('removes trailing dot', () => {
      expect(normalizeDomain('example.com.')).toBe('example.com')
    })

    it('handles already normalized domain', () => {
      expect(normalizeDomain('example.com')).toBe('example.com')
    })

    it('handles complex domains', () => {
      expect(normalizeDomain('Sub.Domain.Example.COM.')).toBe('sub.domain.example.com')
    })
  })

  describe('isValidDid', () => {
    it('returns true for valid did:web', () => {
      expect(isValidDid('did:web:example.com')).toBe(true)
    })

    it('returns true for valid did:pkh', () => {
      expect(isValidDid('did:pkh:eip155:1:0xabc123')).toBe(true)
    })

    it('returns true for valid did:key', () => {
      expect(isValidDid('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK')).toBe(true)
    })

    it('returns true for valid did:handle', () => {
      expect(isValidDid('did:handle:twitter:alice')).toBe(true)
    })

    it('returns false for invalid format (no did: prefix)', () => {
      expect(isValidDid('web:example.com')).toBe(false)
    })

    it('returns false for invalid format (no identifier)', () => {
      expect(isValidDid('did:web:')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isValidDid('')).toBe(false)
    })

    it('returns false for random string', () => {
      expect(isValidDid('random string')).toBe(false)
    })
  })

  describe('extractDidMethod', () => {
    it('extracts method from did:web', () => {
      expect(extractDidMethod('did:web:example.com')).toBe('web')
    })

    it('extracts method from did:pkh', () => {
      expect(extractDidMethod('did:pkh:eip155:1:0xabc')).toBe('pkh')
    })

    it('extracts method from did:key', () => {
      expect(extractDidMethod('did:key:z6Mk...')).toBe('key')
    })

    it('extracts method from did:handle', () => {
      expect(extractDidMethod('did:handle:twitter:alice')).toBe('handle')
    })

    it('returns null for invalid DID', () => {
      expect(extractDidMethod('invalid')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(extractDidMethod('')).toBeNull()
    })
  })

  describe('extractDidIdentifier', () => {
    it('extracts identifier from did:web', () => {
      expect(extractDidIdentifier('did:web:example.com')).toBe('example.com')
    })

    it('extracts identifier from did:web with path', () => {
      expect(extractDidIdentifier('did:web:example.com/path')).toBe('example.com/path')
    })

    it('extracts identifier from did:pkh', () => {
      expect(extractDidIdentifier('did:pkh:eip155:1:0xabc')).toBe('eip155:1:0xabc')
    })

    it('extracts identifier from did:handle', () => {
      expect(extractDidIdentifier('did:handle:twitter:alice')).toBe('twitter:alice')
    })

    it('returns null for invalid DID', () => {
      expect(extractDidIdentifier('invalid')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(extractDidIdentifier('')).toBeNull()
    })
  })

  describe('normalizeDidWeb', () => {
    it('adds did:web: prefix if missing', () => {
      expect(normalizeDidWeb('example.com')).toBe('did:web:example.com')
    })

    it('preserves existing did:web: prefix', () => {
      expect(normalizeDidWeb('did:web:example.com')).toBe('did:web:example.com')
    })

    it('lowercases the domain', () => {
      expect(normalizeDidWeb('Example.COM')).toBe('did:web:example.com')
    })

    it('lowercases with existing prefix', () => {
      expect(normalizeDidWeb('did:web:Example.COM')).toBe('did:web:example.com')
    })

    it('trims whitespace', () => {
      expect(normalizeDidWeb('  example.com  ')).toBe('did:web:example.com')
    })

    it('handles complex domains', () => {
      expect(normalizeDidWeb('Sub.Domain.Example.COM')).toBe('did:web:sub.domain.example.com')
    })
  })
})
