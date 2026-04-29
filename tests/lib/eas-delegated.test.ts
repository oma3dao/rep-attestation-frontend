/**
 * Tests for EAS delegated attestation utilities
 *
 * Tests the SDK's buildDelegatedAttestationTypedData and splitSignature
 * which are used by the frontend's delegated attestation flow.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createRequire } from 'module'
import { Wallet } from 'ethers'
import type { PrepareDelegatedAttestationParams } from '@oma3/omatrust/reputation'
const require = createRequire(import.meta.url)

let splitSignature: (signature: string) => { v: number; r: string; s: string }
let buildDelegatedAttestationTypedData: (params: PrepareDelegatedAttestationParams) => {
  domain: Record<string, unknown>
  types: Record<string, unknown>
  message: Record<string, unknown>
}

beforeAll(async () => {
  const mod = require('@oma3/omatrust/reputation')
  splitSignature = mod.splitSignature
  buildDelegatedAttestationTypedData = mod.buildDelegatedAttestationTypedData
})

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
  let validSignature = ''

  beforeAll(async () => {
    const wallet = new Wallet('0x59c6995e998f97a5a0044966f094538e6df77609f68e4f6f5f79f63f65e6f8f6')
    validSignature = await wallet.signMessage('omatrust split signature test')
  })

  it('extracts r component (first 32 bytes) matching the signature', () => {
    const { r } = splitSignature(validSignature)
    const expectedR = '0x' + validSignature.slice(2, 66)
    expect(r).toBe(expectedR)
  })

  it('extracts s component (next 32 bytes) matching the signature', () => {
    const { s } = splitSignature(validSignature)
    const expectedS = '0x' + validSignature.slice(66, 130)
    expect(s).toBe(expectedS)
  })

  it('extracts v component (last byte) matching the signature', () => {
    const { v } = splitSignature(validSignature)
    const rawV = parseInt(validSignature.slice(130, 132), 16)
    const expectedV = rawV < 27 ? rawV + 27 : rawV
    expect(v).toBe(expectedV)
  })

  it('rejects malformed signatures', () => {
    expect(() => splitSignature('0xinvalid')).toThrow('Invalid signature')
  })

  it('handles uppercase hex and produces same components', () => {
    const sig = validSignature.toUpperCase()
    const { r, s, v } = splitSignature(sig)
    const lowerResult = splitSignature(validSignature)
    expect(r.toLowerCase()).toBe(lowerResult.r.toLowerCase())
    expect(s.toLowerCase()).toBe(lowerResult.s.toLowerCase())
    expect(v).toBe(lowerResult.v)
  })
})
