import { describe, it, expect } from 'vitest'
import {
  normalizeDid,
  computeDidHash,
  computeDidAddress,
  didToAddress,
  validateDidAddress,
  normalizeDomain,
  isValidDid,
  extractDidMethod,
  extractDidIdentifier,
  normalizeDidWeb
} from '@oma3/omatrust/identity'

describe('@oma3/omatrust/identity integration', () => {
  describe('normalizeDid', () => {
    describe('did:web', () => {
      it('lowercases the host', () => {
        expect(normalizeDid('did:web:Example.COM')).toBe('did:web:example.com')
      })

      it('preserves the path', () => {
        expect(normalizeDid('did:web:Example.COM/path/to/resource')).toBe('did:web:example.com/path/to/resource')
      })

      it('handles host without path', () => {
        expect(normalizeDid('did:web:example.com')).toBe('did:web:example.com')
      })
    })

    describe('did:pkh', () => {
      it('lowercases the address', () => {
        expect(normalizeDid('did:pkh:eip155:1:0xABCDEF1234567890ABCDEF1234567890ABCDEF12'))
          .toBe('did:pkh:eip155:1:0xabcdef1234567890abcdef1234567890abcdef12')
      })
    })

    describe('did:handle', () => {
      it('lowercases platform', () => {
        // SDK normalizes platform to lowercase but preserves username case
        expect(normalizeDid('did:handle:Twitter:Alice'))
          .toBe('did:handle:twitter:Alice')
      })
    })

    describe('did:key', () => {
      it('preserves the key portion (case-sensitive)', () => {
        const keyDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
        expect(normalizeDid(keyDid)).toBe(keyDid)
      })
    })
  })

  describe('computeDidHash', () => {
    it('returns a consistent 32-byte hex hash for a known DID', () => {
      const hash = computeDidHash('did:web:example.com')
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/)
      const hash2 = computeDidHash('did:web:example.com')
      expect(hash).toBe(hash2)
    })

    it('returns different hash for different DIDs', () => {
      const hash1 = computeDidHash('did:web:example.com')
      const hash2 = computeDidHash('did:web:other.com')
      expect(hash1).not.toBe(hash2)
    })

    it('normalizes before hashing', () => {
      const hash1 = computeDidHash('did:web:Example.COM')
      const hash2 = computeDidHash('did:web:example.com')
      expect(hash1).toBe(hash2)
    })
  })

  describe('computeDidAddress', () => {
    it('returns last 20 bytes of hash as address', () => {
      const hash = computeDidHash('did:web:example.com')
      const addr = computeDidAddress(hash)
      expect(addr).toBe('0x' + hash.slice(-40))
    })

    it('returns consistent address for same hash', () => {
      const hash = computeDidHash('did:web:example.com')
      const addr1 = computeDidAddress(hash)
      const addr2 = computeDidAddress(hash)
      expect(addr1).toBe(addr2)
    })
  })

  describe('didToAddress', () => {
    it('converts DID to address via hash truncation', () => {
      const hash = computeDidHash('did:web:example.com')
      const address = didToAddress('did:web:example.com')
      expect(address).toBe('0x' + hash.slice(-40))
    })

    it('returns consistent address for same DID', () => {
      const addr1 = didToAddress('did:web:example.com')
      const addr2 = didToAddress('did:web:example.com')
      expect(addr1).toBe(addr2)
    })

    it('handles different DID methods', () => {
      const webAddr = didToAddress('did:web:example.com')
      const pkhAddr = didToAddress('did:pkh:eip155:1:0xabc123')
      expect(webAddr).not.toBe(pkhAddr)
    })
  })

  describe('validateDidAddress', () => {
    it('returns true for valid DID and matching address', () => {
      const did = 'did:web:example.com'
      const addr = didToAddress(did)
      expect(validateDidAddress(did, addr)).toBe(true)
    })

    it('returns true for case-insensitive address comparison', () => {
      const did = 'did:web:example.com'
      const addr = didToAddress(did)
      expect(validateDidAddress(did, addr.toUpperCase())).toBe(true)
    })

    it('returns false for mismatched address', () => {
      const did = 'did:web:example.com'
      expect(validateDidAddress(did, '0x0000000000000000000000000000000000000000')).toBe(false)
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
  })

  describe('isValidDid', () => {
    it('returns true for valid did:web', () => {
      expect(isValidDid('did:web:example.com')).toBe(true)
    })

    it('returns true for valid did:pkh', () => {
      expect(isValidDid('did:pkh:eip155:1:0xabc123')).toBe(true)
    })

    it('returns false for invalid format', () => {
      expect(isValidDid('web:example.com')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isValidDid('')).toBe(false)
    })
  })

  describe('extractDidMethod', () => {
    it('extracts method from did:web', () => {
      expect(extractDidMethod('did:web:example.com')).toBe('web')
    })

    it('extracts method from did:pkh', () => {
      expect(extractDidMethod('did:pkh:eip155:1:0xabc')).toBe('pkh')
    })

    it('returns null for invalid DID', () => {
      expect(extractDidMethod('invalid')).toBeNull()
    })
  })

  describe('extractDidIdentifier', () => {
    it('extracts identifier from did:web', () => {
      expect(extractDidIdentifier('did:web:example.com')).toBe('example.com')
    })

    it('extracts identifier from did:pkh', () => {
      expect(extractDidIdentifier('did:pkh:eip155:1:0xabc')).toBe('eip155:1:0xabc')
    })

    it('returns null for invalid DID', () => {
      expect(extractDidIdentifier('invalid')).toBeNull()
    })
  })

  describe('normalizeDidWeb', () => {
    it('adds did:web: prefix if missing', () => {
      expect(normalizeDidWeb('example.com')).toBe('did:web:example.com')
    })

    it('preserves existing did:web: prefix', () => {
      expect(normalizeDidWeb('did:web:example.com')).toBe('did:web:example.com')
    })

    it('lowercases the host', () => {
      expect(normalizeDidWeb('Example.COM')).toBe('did:web:example.com')
    })
  })
})
