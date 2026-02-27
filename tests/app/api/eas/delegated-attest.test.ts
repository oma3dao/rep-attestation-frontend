/**
 * Tests for EAS delegated attestation API route
 * 
 * Tests the HTTP layer for POST /api/eas/delegated-attest
 * Core business logic is tested in tests/lib/eas-routes.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the eas-routes module
const mockSubmitDelegatedAttestation = vi.fn()

vi.mock('@/lib/server/eas-routes', () => ({
  submitDelegatedAttestation: mockSubmitDelegatedAttestation,
  EasRouteError: class EasRouteError extends Error {
    statusCode: number
    code?: string
    constructor(message: string, statusCode: number, code?: string) {
      super(message)
      this.name = 'EasRouteError'
      this.statusCode = statusCode
      this.code = code
    }
  },
}))

// Test data
const mockDelegatedData = {
  schema: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  recipient: '0xabcdef1234567890abcdef1234567890abcdef12',
  expirationTime: 0,
  revocable: true,
  refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
  data: '0xdeadbeef',
  deadline: Math.floor(Date.now() / 1000) + 600,
}

const mockSignature = '0x' + 'aa'.repeat(32) + 'bb'.repeat(32) + '1b'
const mockAttester = '0x1234567890123456789012345678901234567890'

function createValidRequest(overrides: Partial<{
  prepared: Record<string, unknown>,
  signature: string,
  attester: string,
}> = {}): NextRequest {
  const defaultPrepared = {
    delegatedRequest: mockDelegatedData,
    typedData: {},
  }

  return new NextRequest('http://localhost/api/eas/delegated-attest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prepared: overrides.prepared ?? defaultPrepared,
      signature: overrides.signature ?? mockSignature,
      attester: overrides.attester ?? mockAttester,
    }),
  })
}

describe('POST /api/eas/delegated-attest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: successful submission
    mockSubmitDelegatedAttestation.mockResolvedValue({
      success: true,
      txHash: '0x' + 'ab'.repeat(32),
      uid: '0x' + 'cd'.repeat(32),
      blockNumber: 12345,
      chain: 'OMAchain Testnet',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('successful requests', () => {
    it('returns success response with txHash and UID', async () => {
      const expectedTxHash = '0x' + 'ef'.repeat(32)
      const expectedUID = '0x' + '12'.repeat(32)
      
      mockSubmitDelegatedAttestation.mockResolvedValue({
        success: true,
        txHash: expectedTxHash,
        uid: expectedUID,
        blockNumber: 99999,
        chain: 'OMAchain Testnet',
      })

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.txHash).toBe(expectedTxHash)
      expect(json.uid).toBe(expectedUID)
      expect(json.blockNumber).toBe(99999)
      expect(json.elapsed).toBeDefined()
    })

    it('passes correct parameters to submitDelegatedAttestation', async () => {
      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      await POST(req)

      expect(mockSubmitDelegatedAttestation).toHaveBeenCalledWith({
        prepared: {
          delegatedRequest: mockDelegatedData,
          typedData: {},
        },
        signature: mockSignature,
        attester: mockAttester,
      })
    })
  })

  describe('request validation errors (400)', () => {
    it('returns 400 when delegated is missing', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Missing required fields: delegated, signature, attester', 400)
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = new NextRequest('http://localhost/api/eas/delegated-attest', {
        method: 'POST',
        body: JSON.stringify({ signature: mockSignature, attester: mockAttester }),
      })
      const res = await POST(req)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('Missing required fields')
    })

    it('returns 400 when signature is missing', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Missing required fields: delegated, signature, attester', 400)
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = new NextRequest('http://localhost/api/eas/delegated-attest', {
        method: 'POST',
        body: JSON.stringify({ delegated: mockDelegatedData, attester: mockAttester }),
      })
      const res = await POST(req)

      expect(res.status).toBe(400)
    })

    it('returns 400 when attester is missing', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Missing required fields: delegated, signature, attester', 400)
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = new NextRequest('http://localhost/api/eas/delegated-attest', {
        method: 'POST',
        body: JSON.stringify({ delegated: mockDelegatedData, signature: mockSignature }),
      })
      const res = await POST(req)

      expect(res.status).toBe(400)
    })

    it('returns 400 for expired signature', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Signature expired', 400, 'SIGNATURE_EXPIRED')
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest({
        prepared: {
          delegatedRequest: {
            ...mockDelegatedData,
            deadline: Math.floor(Date.now() / 1000) - 3600,
          },
          typedData: {},
        },
      })
      const res = await POST(req)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('expired')
      expect(json.code).toBe('SIGNATURE_EXPIRED')
    })

    it('returns 400 for invalid signature format', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Invalid signature format', 400, 'INVALID_SIGNATURE')
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest({ signature: '0xinvalid' })
      const res = await POST(req)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('INVALID_SIGNATURE')
    })

    it('returns 400 for attester mismatch', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Invalid signature - attester mismatch', 400, 'ATTESTER_MISMATCH')
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('ATTESTER_MISMATCH')
    })
  })

  describe('schema validation errors (403)', () => {
    it('returns 403 when schema is not subsidized', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Schema not eligible for gas subsidy', 403, 'SCHEMA_NOT_SUBSIDIZED')
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toContain('not eligible')
      expect(json.code).toBe('SCHEMA_NOT_SUBSIDIZED')
    })
  })

  describe('idempotency errors (409)', () => {
    it('returns 409 for duplicate signature submission', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Duplicate submission', 409, 'DUPLICATE')
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      expect(res.status).toBe(409)
      const json = await res.json()
      expect(json.error).toContain('Duplicate')
      expect(json.code).toBe('DUPLICATE')
    })
  })

  describe('server errors (500)', () => {
    it('returns 500 when delegate key is not configured', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Server misconfigured - EAS delegate key not available', 500, 'NO_DELEGATE_KEY')
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.code).toBe('NO_DELEGATE_KEY')
    })

    it('returns 500 for RPC errors', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Failed to fetch nonce: RPC error', 500)
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toContain('Failed to fetch nonce')
    })

    it('returns 500 for unexpected errors', async () => {
      mockSubmitDelegatedAttestation.mockRejectedValue(new Error('Unexpected error'))

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toBe('Unexpected error')
    })

    it('returns 500 for invalid JSON body', async () => {
      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = new NextRequest('http://localhost/api/eas/delegated-attest', {
        method: 'POST',
        body: 'not json',
      })
      const res = await POST(req)

      expect(res.status).toBe(500)
    })
  })

  describe('mainnet restriction (501)', () => {
    it('returns 501 for mainnet submissions', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Mainnet delegated attestations not yet available', 501, 'MAINNET_NOT_SUPPORTED')
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      expect(res.status).toBe(501)
      const json = await res.json()
      expect(json.error).toBe('Mainnet delegated attestations not yet available')
      expect(json.code).toBe('MAINNET_NOT_SUPPORTED')
    })
  })

  describe('response format', () => {
    it('includes elapsed time in successful responses', async () => {
      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      const json = await res.json()
      expect(json.elapsed).toMatch(/^\d+ms$/)
    })

    it('includes elapsed time in error responses', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Test error', 400)
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      const json = await res.json()
      expect(json.elapsed).toMatch(/^\d+ms$/)
    })

    it('includes error code when available', async () => {
      const { EasRouteError } = await import('@/lib/server/eas-routes')
      mockSubmitDelegatedAttestation.mockRejectedValue(
        new EasRouteError('Test error', 400, 'TEST_CODE')
      )

      const { POST } = await import('@/app/api/eas/delegated-attest/route')
      const req = createValidRequest()
      const res = await POST(req)

      const json = await res.json()
      expect(json.code).toBe('TEST_CODE')
    })
  })
})
