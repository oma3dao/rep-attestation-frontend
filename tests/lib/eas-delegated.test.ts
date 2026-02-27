/**
 * Tests for EAS delegated attestation utilities
 *
 * Tests the SDK's buildDelegatedAttestationTypedData and splitSignature
 * which are used by the frontend's delegated attestation flow.
 */

import { describe, it, expect } from 'vitest'
import {
  splitSignature,
  buildDelegatedAttestationTypedData,
  type PrepareDelegatedAttestationParams,
} from '@oma3/omatrust/reputation'

describe('buildDelegatedAttestationTypedData', () => {
  const mockParams: PrepareDelegatedAttestationParams = {
    chainId: 66238,
    easContractAddress: '0x4200000000000000000000000000000000000021',
    schemaUid: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    schema: 'string subject, uint64 issuedAt',
    data: { subject: 'did:web:example.com', issuedAt: 1700000000 },
    attester: '0x1234567890123456789012345678901234567890',
    nonce: BigInt(0),
    revocable: true,
    deadline: 1700000000,
  }

  it('returns object with domain, types, and message', () => {
    const result = buildDelegatedAttestationTypedData(mockParams)
    expect(result).toHaveProperty('domain')
    expect(result).toHaveProperty('types')
    expect(result).toHaveProperty('message')
  })

  it('has correct EAS domain name and version', () => {
    const result = buildDelegatedAttestationTypedData(mockParams)
    expect(result.domain.name).toBe('EAS')
    expect(result.domain.version).toBe('1.4.0')
  })

  it('includes chainId in domain', () => {
    const result = buildDelegatedAttestationTypedData(mockParams)
    expect(result.domain.chainId).toBe(66238)
  })

  it('includes verifyingContract in domain', () => {
    const result = buildDelegatedAttestationTypedData(mockParams)
    expect(result.domain.verifyingContract).toBe(mockParams.easContractAddress)
  })

  it('includes all required fields in Attest type', () => {
    const result = buildDelegatedAttestationTypedData(mockParams)
    const attestType = result.types.Attest as Array<{ name: string; type: string }>
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

  it('message contains attester and schema', () => {
    const result = buildDelegatedAttestationTypedData(mockParams)
    const msg = result.message as Record<string, unknown>
    expect(msg.attester).toBe(mockParams.attester)
    expect(msg.schema).toBe(mockParams.schemaUid)
    expect(msg.revocable).toBe(true)
    expect(msg.nonce).toBe(BigInt(0))
    expect(msg.value).toBe(BigInt(0))
  })

  it('handles different chain IDs', () => {
    const chains = [1, 10, 8453, 42161, 66238]
    for (const chain of chains) {
      const result = buildDelegatedAttestationTypedData({ ...mockParams, chainId: chain })
      expect(result.domain.chainId).toBe(chain)
    }
  })

  it('handles revocable=false', () => {
    const result = buildDelegatedAttestationTypedData({ ...mockParams, revocable: false })
    expect((result.message as Record<string, unknown>).revocable).toBe(false)
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
      '00'
    const { v } = splitSignature(sigWithV0)
    expect(v).toBe(27)
  })

  it('normalizes v=1 to v=28', () => {
    const sigWithV1 = '0x' +
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' +
      '01'
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
      '1c'
    const { v } = splitSignature(sigWithV28)
    expect(v).toBe(28)
  })

  it('handles uppercase hex', () => {
    const sig = '0x' + 'AA'.repeat(32) + 'BB'.repeat(32) + '1B'
    const { r, s, v } = splitSignature(sig)
    expect(r).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(s).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(v).toBe(27)
  })
})
