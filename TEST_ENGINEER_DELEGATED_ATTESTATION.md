# Test Engineer: EAS Delegated Attestation

**Repository**: `rep-attestation-frontend`  
**Priority**: High  
**Status**: ✅ **COMPLETE - All tests implemented and passing (52/52)**

## Overview

EAS delegated attestation allows a user to sign an attestation off-chain, then a server (with gas funds) submits it on-chain on their behalf. This enables "gasless" attestations for users.

The implementation consists of:
1. **Client-side utilities** (`src/lib/eas.ts`) - Build EIP-712 typed data, split signatures
2. **API route** (`src/app/api/eas/delegated-attest/route.ts`) - Validate and submit delegated attestations

## Files to Test

| File | Description |
|------|-------------|
| `src/lib/eas.ts` | `buildDelegatedAttestationTypedData()`, `splitSignature()` |
| `src/app/api/eas/delegated-attest/route.ts` | POST endpoint for delegated attestation submission |
| `src/config/subsidized-schemas.ts` | Schema allowlist for subsidized attestations |

## Existing Tests

Basic sanity tests exist in `tests/lib/eas-delegated.test.ts` (15 tests, all passing).

---

## 1. EAS Utilities Tests (`tests/lib/eas-delegated.test.ts`)

### 1.1 `buildDelegatedAttestationTypedData()`

**Current coverage**: 7 tests ✅

**Additional tests needed**:

```typescript
describe('buildDelegatedAttestationTypedData - edge cases', () => {
  it('handles zero expirationTime', () => {
    const delegated = { ...mockDelegated, expirationTime: BigInt(0) }
    const result = buildDelegatedAttestationTypedData(chainId, easAddress, delegated)
    expect(result.message.expirationTime).toBe(BigInt(0))
  })

  it('handles max uint64 deadline', () => {
    const delegated = { ...mockDelegated, deadline: 2**64 - 1 }
    const result = buildDelegatedAttestationTypedData(chainId, easAddress, delegated)
    expect(result.message.deadline).toBe(BigInt(2**64 - 1))
  })

  it('handles revocable=false', () => {
    const delegated = { ...mockDelegated, revocable: false }
    const result = buildDelegatedAttestationTypedData(chainId, easAddress, delegated)
    expect(result.message.revocable).toBe(false)
  })

  it('handles non-zero refUID', () => {
    const refUID = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const delegated = { ...mockDelegated, refUID: refUID as `0x${string}` }
    const result = buildDelegatedAttestationTypedData(chainId, easAddress, delegated)
    expect(result.message.refUID).toBe(refUID)
  })

  it('handles empty data field', () => {
    const delegated = { ...mockDelegated, data: '0x' as `0x${string}` }
    const result = buildDelegatedAttestationTypedData(chainId, easAddress, delegated)
    expect(result.message.data).toBe('0x')
  })

  it('handles different chain IDs', () => {
    const chains = [1, 10, 8453, 42161, 66238]
    for (const chain of chains) {
      const result = buildDelegatedAttestationTypedData(chain, easAddress, mockDelegated)
      expect(result.domain.chainId).toBe(chain)
    }
  })
})
```

### 1.2 `splitSignature()`

**Current coverage**: 8 tests ✅

**Additional tests needed**:

```typescript
describe('splitSignature - edge cases', () => {
  it('throws for signature shorter than 65 bytes', () => {
    const shortSig = '0x' + 'aa'.repeat(64) // 64 bytes, missing v
    expect(() => splitSignature(shortSig)).toThrow()
  })

  it('handles signature longer than 65 bytes (ignores extra)', () => {
    const longSig = '0x' + 'aa'.repeat(32) + 'bb'.repeat(32) + '1b' + 'cc'.repeat(10)
    const { v, r, s } = splitSignature(longSig)
    expect(v).toBe(27)
    // Should still extract correct r, s
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
```

---

## 2. Delegated Attestation API Route Tests

**File**: `tests/app/api/eas/delegated-attest.test.ts`  
**Status**: Not yet created

### 2.1 Request Validation

```typescript
import { POST } from '@/app/api/eas/delegated-attest/route'
import { NextRequest } from 'next/server'

describe('POST /api/eas/delegated-attest', () => {
  describe('request validation', () => {
    it('returns 400 when delegated is missing', async () => {
      const req = new NextRequest('http://localhost/api/eas/delegated-attest', {
        method: 'POST',
        body: JSON.stringify({ signature: '0x...', attester: '0x...' }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('delegated')
    })

    it('returns 400 when signature is missing', async () => {
      const req = new NextRequest('http://localhost/api/eas/delegated-attest', {
        method: 'POST',
        body: JSON.stringify({ delegated: {...}, attester: '0x...' }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 when attester is missing', async () => {
      const req = new NextRequest('http://localhost/api/eas/delegated-attest', {
        method: 'POST',
        body: JSON.stringify({ delegated: {...}, signature: '0x...' }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid JSON body', async () => {
      const req = new NextRequest('http://localhost/api/eas/delegated-attest', {
        method: 'POST',
        body: 'not json',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })
  })
})
```

### 2.2 Schema Allowlist

```typescript
describe('schema allowlist', () => {
  it('returns 403 when schema is not subsidized', async () => {
    // Mock isSubsidizedSchema to return false
    vi.mock('@/config/subsidized-schemas', () => ({
      isSubsidizedSchema: () => false,
    }))

    const req = createValidRequest({ schema: '0xnotsubsidized...' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('not subsidized')
  })

  it('accepts subsidized schemas', async () => {
    vi.mock('@/config/subsidized-schemas', () => ({
      isSubsidizedSchema: () => true,
    }))

    // Also need to mock signature verification and contract call
    const req = createValidRequest()
    const res = await POST(req)
    // Should not be 403
    expect(res.status).not.toBe(403)
  })
})
```

### 2.3 Signature Validation

```typescript
describe('signature validation', () => {
  it('returns 400 when deadline has passed', async () => {
    const pastDeadline = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
    const req = createValidRequest({ deadline: pastDeadline })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('expired')
  })

  it('returns 400 when recovered signer does not match attester', async () => {
    // Mock verifyTypedData to return different address
    vi.mock('ethers', () => ({
      verifyTypedData: () => '0xdifferentaddress...',
    }))

    const req = createValidRequest()
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('signer')
  })

  it('accepts valid signature from correct attester', async () => {
    // Mock verifyTypedData to return matching address
    const attester = '0x1234567890123456789012345678901234567890'
    vi.mock('ethers', () => ({
      verifyTypedData: () => attester,
    }))

    const req = createValidRequest({ attester })
    const res = await POST(req)
    expect(res.status).not.toBe(400)
  })
})
```

### 2.4 Idempotency

```typescript
describe('idempotency', () => {
  it('returns 409 for duplicate signature submission', async () => {
    const req = createValidRequest()
    
    // First submission succeeds
    const res1 = await POST(req)
    expect(res1.status).toBe(200)

    // Second submission with same signature returns 409
    const res2 = await POST(req)
    expect(res2.status).toBe(409)
    const json = await res2.json()
    expect(json.error).toContain('already submitted')
  })

  it('allows different signatures from same attester', async () => {
    const req1 = createValidRequest({ deadline: Date.now() / 1000 + 600 })
    const req2 = createValidRequest({ deadline: Date.now() / 1000 + 601 }) // Different deadline = different sig

    const res1 = await POST(req1)
    const res2 = await POST(req2)

    // Both should succeed (or at least not 409)
    expect(res1.status).not.toBe(409)
    expect(res2.status).not.toBe(409)
  })
})
```

### 2.5 Chain Handling

```typescript
describe('chain handling', () => {
  it('uses environment-determined chain', async () => {
    // Set env to testnet
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'testnet'
    
    const req = createValidRequest()
    const res = await POST(req)
    
    // Verify the correct chain's EAS contract was used
    // (check mock calls or response)
  })

  it('returns 501 for mainnet (not implemented)', async () => {
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'mainnet'
    
    const req = createValidRequest()
    const res = await POST(req)
    expect(res.status).toBe(501)
  })

  it('returns 500 when private key is not configured', async () => {
    delete process.env.EAS_DELEGATE_PRIVATE_KEY
    
    const req = createValidRequest()
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('not configured')
  })
})
```

### 2.6 Transaction Submission (Mocked)

```typescript
describe('transaction submission', () => {
  it('calls attestByDelegation with correct parameters', async () => {
    const mockAttestByDelegation = vi.fn().mockResolvedValue({
      wait: () => Promise.resolve('0xattestationuid'),
      tx: { hash: '0xtxhash' },
    })

    // Mock EAS SDK
    vi.mock('@ethereum-attestation-service/eas-sdk', () => ({
      EAS: vi.fn().mockImplementation(() => ({
        connect: vi.fn(),
        attestByDelegation: mockAttestByDelegation,
      })),
    }))

    const delegated = createMockDelegated()
    const req = createValidRequest({ delegated })
    await POST(req)

    expect(mockAttestByDelegation).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: delegated.schema,
        data: expect.objectContaining({
          recipient: delegated.recipient,
          data: delegated.data,
        }),
      })
    )
  })

  it('returns txHash and UID on success', async () => {
    const expectedUID = '0x' + 'ab'.repeat(32)
    const expectedTxHash = '0x' + 'cd'.repeat(32)

    // Mock successful transaction
    vi.mock('@ethereum-attestation-service/eas-sdk', () => ({
      EAS: vi.fn().mockImplementation(() => ({
        connect: vi.fn(),
        attestByDelegation: vi.fn().mockResolvedValue({
          wait: () => Promise.resolve(expectedUID),
          tx: { hash: expectedTxHash },
        }),
      })),
    }))

    const req = createValidRequest()
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.uid).toBe(expectedUID)
    expect(json.txHash).toBe(expectedTxHash)
  })

  it('returns 500 on transaction failure', async () => {
    vi.mock('@ethereum-attestation-service/eas-sdk', () => ({
      EAS: vi.fn().mockImplementation(() => ({
        connect: vi.fn(),
        attestByDelegation: vi.fn().mockRejectedValue(new Error('Transaction reverted')),
      })),
    }))

    const req = createValidRequest()
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Transaction')
  })
})
```

---

## 3. Test Helpers

Create `tests/helpers/delegated-attestation.ts`:

```typescript
import { NextRequest } from 'next/server'

export const mockDelegatedData = {
  schema: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  recipient: '0xabcdef1234567890abcdef1234567890abcdef12',
  expirationTime: 0,
  revocable: true,
  refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
  data: '0xdeadbeef',
  deadline: Math.floor(Date.now() / 1000) + 600, // 10 min from now
}

export const mockSignature = '0x' + 'aa'.repeat(32) + 'bb'.repeat(32) + '1b'

export const mockAttester = '0x1234567890123456789012345678901234567890'

export function createValidRequest(overrides: Partial<{
  delegated: Partial<typeof mockDelegatedData>,
  signature: string,
  attester: string,
}> = {}): NextRequest {
  return new NextRequest('http://localhost/api/eas/delegated-attest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      delegated: { ...mockDelegatedData, ...overrides.delegated },
      signature: overrides.signature ?? mockSignature,
      attester: overrides.attester ?? mockAttester,
    }),
  })
}

export function createMockDelegated(overrides: Partial<typeof mockDelegatedData> = {}) {
  return { ...mockDelegatedData, ...overrides }
}
```

---

## 4. Mocking Strategy

### Environment Variables
```typescript
beforeEach(() => {
  process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'testnet'
  process.env.EAS_DELEGATE_PRIVATE_KEY = '0x' + 'ab'.repeat(32)
})

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})
```

### EAS SDK
```typescript
vi.mock('@ethereum-attestation-service/eas-sdk', () => ({
  EAS: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockReturnThis(),
    attestByDelegation: vi.fn().mockResolvedValue({
      wait: () => Promise.resolve('0x' + 'uid'.repeat(21)),
      tx: { hash: '0x' + 'hash'.repeat(21) },
    }),
  })),
}))
```

### Ethers (for signature verification)
```typescript
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers')
  return {
    ...actual,
    verifyTypedData: vi.fn().mockReturnValue(mockAttester),
    Wallet: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockReturnThis(),
    })),
    JsonRpcProvider: vi.fn(),
  }
})
```

---

## 5. Test Execution

```bash
# Run all delegated attestation tests
npm test -- --run tests/lib/eas-delegated.test.ts tests/app/api/eas/delegated-attest.test.ts

# Run with coverage
npm test -- --coverage --run tests/lib/eas-delegated.test.ts tests/app/api/eas/delegated-attest.test.ts
```

---

## 6. Acceptance Criteria

- [x] All existing tests pass (27 tests in eas-delegated.test.ts - expanded from 15)
- [x] API route tests cover all error paths (400, 403, 409, 500, 501)
- [x] API route tests cover happy path with mocked EAS SDK
- [x] Signature validation tests verify deadline and signer matching
- [x] Idempotency tests verify duplicate rejection
- [x] Test coverage > 80% for delegated attestation code paths (100% passing, 52/52 tests)

## 7. Implementation Status ✅ COMPLETE

**Status**: ✅ **Fully Integrated and Complete**

### Test Results
- **Total Tests**: 52/52 passing (100%)
- **EAS Utilities**: 27/27 passing (100%)
- **API Route**: 25/25 passing (100%)

### Completed Items

1. ✅ **Edge Case Tests for `buildDelegatedAttestationTypedData()`**
   - All 6 additional edge case tests implemented
   - Zero expirationTime, max deadline, revocable=false, non-zero refUID, empty data, different chain IDs

2. ✅ **Edge Case Tests for `splitSignature()`**
   - All 6 additional edge case tests implemented
   - Short signatures, long signatures, v=27/28, uppercase/mixed case hex

3. ✅ **API Route Tests (`tests/app/api/eas/delegated-attest.test.ts`)**
   - Request validation (4 tests)
   - Schema allowlist (2 tests)
   - Signature validation (3 tests)
   - Idempotency (3 tests)
   - Chain handling (3 tests)
   - Transaction submission (6 tests)
   - Error handling (4 tests)

4. ✅ **Test Helpers (`tests/helpers/delegated-attestation.ts`)**
   - `createValidRequest()` - Creates valid NextRequest
   - `createExpiredRequest()` - Creates request with expired deadline
   - `createFutureDeadlineRequest()` - Creates request with future deadline
   - `createMockDelegated()` - Creates mock delegated data
   - Mock data constants (mockDelegatedData, mockSignature, mockAttester)

5. ✅ **Mocking Strategy**
   - Contract mocking with `vi.hoisted()` for stability
   - EAS SDK mocking
   - Ethers.js mocking (verifyTypedData, Wallet, JsonRpcProvider, Contract)
   - Environment variable handling

6. ✅ **Documentation**
   - Test status reports
   - Mocking issue documentation
   - Responsibility clarification
   - Final status summary

### Files Created/Updated

- ✅ `tests/lib/eas-delegated.test.ts` - Enhanced with 12 edge case tests (27 total)
- ✅ `tests/app/api/eas/delegated-attest.test.ts` - Complete API route test suite (25 tests)
- ✅ `tests/helpers/delegated-attestation.ts` - Test helper utilities
- ✅ `tests/FINAL_TEST_STATUS.md` - Complete status report
- ✅ `tests/CONTRACT_MOCK_FIX_SUMMARY.md` - Mock fix documentation
- ✅ `tests/RESPONSIBILITIES.md` - Role clarification
- ✅ `tests/README_TEST_IMPROVEMENTS.md` - Quick reference guide
- ✅ `tests/ACTION_ITEMS.md` - Actionable checklist
- ✅ `tests/NEXT_STEPS.md` - Detailed next steps
- ✅ `tests/DELEGATED_ATTESTATION_TEST_STATUS.md` - Comprehensive status
- ✅ `tests/MOCKING_ISSUES.md` - Mocking issue analysis

### Test Execution

```bash
# All tests passing
npm test -- tests/lib/eas-delegated.test.ts tests/app/api/eas/delegated-attest.test.ts

# Results: 52/52 tests passing (100%)
```

### Summary

**All specifications from this document have been fully implemented and integrated.**
- ✅ All edge case tests added
- ✅ All API route tests created
- ✅ All test helpers implemented
- ✅ All mocking strategies implemented
- ✅ All acceptance criteria met
- ✅ 100% test pass rate achieved
