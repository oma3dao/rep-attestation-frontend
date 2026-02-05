/**
 * Basic tests for EAS delegated attestation utilities
 * 
 * These are sanity checks for the delegated attestation functions.
 * See TEST_ENGINEER_DELEGATED_ATTESTATION.md for comprehensive test specifications.
 */

import { describe, it, expect } from 'vitest'
import {
  buildDelegatedAttestationTypedData,
  splitSignature,
  type DelegatedAttestationData,
} from '@/lib/eas'

describe('buildDelegatedAttestationTypedData', () => {
  const mockDelegated: DelegatedAttestationData = {
    schema: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
    recipient: '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
    expirationTime: BigInt(0),
    revocable: true,
    refUID: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    data: '0xdeadbeef' as `0x${string}`,
    deadline: 1700000000,
  }
  const mockAttester = '0x1234567890123456789012345678901234567890' as `0x${string}`
  const mockNonce = BigInt(0)

  it('returns object with domain, types, primaryType, and message', () => {
    const result = buildDelegatedAttestationTypedData(
      66238, // OMAchain testnet
      '0x4200000000000000000000000000000000000021' as `0x${string}`,
      mockDelegated,
      mockAttester,
      mockNonce
    )

    expect(result).toHaveProperty('domain')
    expect(result).toHaveProperty('types')
    expect(result).toHaveProperty('primaryType')
    expect(result).toHaveProperty('message')
  })

  it('has correct EAS domain name and version', () => {
    const result = buildDelegatedAttestationTypedData(
      66238,
      '0x4200000000000000000000000000000000000021' as `0x${string}`,
      mockDelegated,
      mockAttester,
      mockNonce
    )

    expect(result.domain.name).toBe('EAS')
    expect(result.domain.version).toBe('1.4.0')  // Must match EAS contract
  })

  it('includes chainId in domain', () => {
    const result = buildDelegatedAttestationTypedData(
      66238,
      '0x4200000000000000000000000000000000000021' as `0x${string}`,
      mockDelegated,
      mockAttester,
      mockNonce
    )

    expect(result.domain.chainId).toBe(66238)
  })

  it('includes verifyingContract in domain', () => {
    const easAddress = '0x4200000000000000000000000000000000000021' as `0x${string}`
    const result = buildDelegatedAttestationTypedData(66238, easAddress, mockDelegated, mockAttester, mockNonce)

    expect(result.domain.verifyingContract).toBe(easAddress)
  })

  it('has Attest as primaryType', () => {
    const result = buildDelegatedAttestationTypedData(
      66238,
      '0x4200000000000000000000000000000000000021' as `0x${string}`,
      mockDelegated,
      mockAttester,
      mockNonce
    )

    expect(result.primaryType).toBe('Attest')
  })

  it('includes all required fields in Attest type', () => {
    const result = buildDelegatedAttestationTypedData(
      66238,
      '0x4200000000000000000000000000000000000021' as `0x${string}`,
      mockDelegated,
      mockAttester,
      mockNonce
    )

    const attestType = result.types.Attest
    const fieldNames = attestType.map(f => f.name)

    expect(fieldNames).toContain('attester')
    expect(fieldNames).toContain('schema')
    expect(fieldNames).toContain('recipient')
    expect(fieldNames).toContain('expirationTime')
    expect(fieldNames).toContain('revocable')
    expect(fieldNames).toContain('refUID')
    expect(fieldNames).toContain('data')
    expect(fieldNames).toContain('value')
    expect(fieldNames).toContain('nonce')
    expect(fieldNames).toContain('deadline')
  })

  it('message contains delegated data and attester/nonce', () => {
    const result = buildDelegatedAttestationTypedData(
      66238,
      '0x4200000000000000000000000000000000000021' as `0x${string}`,
      mockDelegated,
      mockAttester,
      mockNonce
    )

    expect(result.message.attester).toBe(mockAttester)
    expect(result.message.schema).toBe(mockDelegated.schema)
    expect(result.message.recipient).toBe(mockDelegated.recipient)
    expect(result.message.revocable).toBe(mockDelegated.revocable)
    expect(result.message.data).toBe(mockDelegated.data)
    expect(result.message.nonce).toBe(mockNonce)
    expect(result.message.value).toBe(BigInt(0))
  })
})

describe('splitSignature', () => {
  // Standard 65-byte signature (r: 32 bytes, s: 32 bytes, v: 1 byte)
  const validSignature = '0x' + 
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' + // r (32 bytes)
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' + // s (32 bytes)
    '1b' // v (1 byte = 27)

  it('extracts r component (first 32 bytes)', () => {
    const { r } = splitSignature(validSignature)
    expect(r).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })

  it('extracts s component (next 32 bytes)', () => {
    const { s } = splitSignature(validSignature)
    expect(s).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
  })

  it('extracts v component (last byte)', () => {
    const { v } = splitSignature(validSignature)
    expect(v).toBe(27)
  })

  it('handles signature without 0x prefix', () => {
    const sigWithoutPrefix = validSignature.slice(2)
    const { r, s, v } = splitSignature(sigWithoutPrefix)
    
    expect(r).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(s).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    expect(v).toBe(27)
  })

  it('normalizes v=0 to v=27', () => {
    const sigWithV0 = '0x' + 
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' +
      '00' // v = 0

    const { v } = splitSignature(sigWithV0)
    expect(v).toBe(27)
  })

  it('normalizes v=1 to v=28', () => {
    const sigWithV1 = '0x' + 
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' +
      '01' // v = 1

    const { v } = splitSignature(sigWithV1)
    expect(v).toBe(28)
  })

  it('preserves v=27 as-is', () => {
    const { v } = splitSignature(validSignature)
    expect(v).toBe(27)
  })

  it('preserves v=28 as-is', () => {
    const sigWithV28 = '0x' + 
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' +
      '1c' // v = 28

    const { v } = splitSignature(sigWithV28)
    expect(v).toBe(28)
  })
})

// ============================================================================
// Edge Case Tests (from TEST_ENGINEER_DELEGATED_ATTESTATION.md)
// ============================================================================

describe('buildDelegatedAttestationTypedData - edge cases', () => {
  const mockDelegated: DelegatedAttestationData = {
    schema: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
    recipient: '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
    expirationTime: BigInt(0),
    revocable: true,
    refUID: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    data: '0xdeadbeef' as `0x${string}`,
    deadline: 1700000000,
  }
  const mockAttester = '0x1234567890123456789012345678901234567890' as `0x${string}`
  const mockNonce = BigInt(0)
  const chainId = 66238
  const easAddress = '0x4200000000000000000000000000000000000021' as `0x${string}`

  it('handles zero expirationTime', () => {
    const delegated = { ...mockDelegated, expirationTime: BigInt(0) }
    const result = buildDelegatedAttestationTypedData(chainId, easAddress, delegated, mockAttester, mockNonce)
    expect(result.message.expirationTime).toBe(BigInt(0))
  })

  it('handles max uint64 deadline', () => {
    const maxDeadline = 2 ** 64 - 1
    const delegated = { ...mockDelegated, deadline: maxDeadline }
    const result = buildDelegatedAttestationTypedData(chainId, easAddress, delegated, mockAttester, mockNonce)
    expect(result.message.deadline).toBe(BigInt(maxDeadline))
  })

  it('handles revocable=false', () => {
    const delegated = { ...mockDelegated, revocable: false }
    const result = buildDelegatedAttestationTypedData(chainId, easAddress, delegated, mockAttester, mockNonce)
    expect(result.message.revocable).toBe(false)
  })

  it('handles non-zero refUID', () => {
    const refUID = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`
    const delegated = { ...mockDelegated, refUID }
    const result = buildDelegatedAttestationTypedData(chainId, easAddress, delegated, mockAttester, mockNonce)
    expect(result.message.refUID).toBe(refUID)
  })

  it('handles empty data field', () => {
    const delegated = { ...mockDelegated, data: '0x' as `0x${string}` }
    const result = buildDelegatedAttestationTypedData(chainId, easAddress, delegated, mockAttester, mockNonce)
    expect(result.message.data).toBe('0x')
  })

  it('handles different chain IDs', () => {
    const chains = [1, 10, 8453, 42161, 66238]
    for (const chain of chains) {
      const result = buildDelegatedAttestationTypedData(chain, easAddress, mockDelegated, mockAttester, mockNonce)
      expect(result.domain.chainId).toBe(chain)
    }
  })
})

describe('splitSignature - edge cases', () => {
  it('handles signature shorter than 65 bytes gracefully', () => {
    // Note: Current implementation doesn't validate length, but should handle gracefully
    const shortSig = '0x' + 'aa'.repeat(64) // 64 bytes, missing v
    // The function will still try to extract, but v will be NaN or incorrect
    // This test documents current behavior - implementation may need validation
    const result = splitSignature(shortSig)
    // Should still return r and s, but v might be invalid
    expect(result).toHaveProperty('r')
    expect(result).toHaveProperty('s')
    expect(result).toHaveProperty('v')
  })

  it('handles signature longer than 65 bytes (ignores extra)', () => {
    const longSig = '0x' + 'aa'.repeat(32) + 'bb'.repeat(32) + '1b' + 'cc'.repeat(10)
    const { v, r, s } = splitSignature(longSig)
    expect(v).toBe(27)
    // Should still extract correct r, s
    expect(r).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(s).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })

  it('handles v=27 without normalization', () => {
    const sig = '0x' + 'aa'.repeat(32) + 'bb'.repeat(32) + '1b'
    const { v } = splitSignature(sig)
    expect(v).toBe(27)
  })

  it('handles v=28 without normalization', () => {
    const sig = '0x' + 'aa'.repeat(32) + 'bb'.repeat(32) + '1c'
    const { v } = splitSignature(sig)
    expect(v).toBe(28)
  })

  it('handles uppercase hex', () => {
    const sig = '0x' + 'AA'.repeat(32) + 'BB'.repeat(32) + '1B'
    const { r, s, v } = splitSignature(sig)
    expect(r).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(s).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(v).toBe(27)
  })

  it('handles mixed case hex', () => {
    const sig = '0x' + 'AaBb'.repeat(16) + 'CcDd'.repeat(16) + '1c'
    const { v } = splitSignature(sig)
    expect(v).toBe(28)
  })
})
